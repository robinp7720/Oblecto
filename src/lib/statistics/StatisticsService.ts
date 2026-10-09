import { Op, type Sequelize } from 'sequelize';
import { ViewingSession, ViewingDay, PlaybackHealth, StatisticsMeta, type DailyAttributes } from '../../models/statistics.js';
import { Movie } from '../../models/movie.js';
import { Episode } from '../../models/episode.js';
import type { File } from '../../models/file.js';
import type Oblecto from '../oblecto/index.js';
import logger from '../../submodules/logger/index.js';
import { account, initialCheckpoint, splitDays, type Checkpoint, type Method, type StatisticsReport } from './accounting.js';

export type Identity = { itemType: string; itemId: number | null; title: string };
export type Gauges = { viewers: number; sessions: number; direct: number; remux: number; transcode: number; encoders: number; queue: number; cacheBytes: number };
export type HealthData = { samples: number; sums: Gauges; peaks: Gauges };
export class StatisticsService {
    private writes: Promise<void> = Promise.resolve();
    private timer?: NodeJS.Timeout;
    private pending = 0;
    degraded = false;
    lastFailureAt: string | null = null;
    private lastPrune = 0;
    private closed = false;
    constructor(private readonly database: Sequelize, private readonly oblecto?: Oblecto, private readonly clock = Date.now) {
        void this.safe(async () => {
            await StatisticsMeta.findOrCreate({ where: { id: 'trackingStartedAt' }, defaults: { id: 'trackingStartedAt', value: new Date(this.clock()).toISOString() } });
            await ViewingSession.update({ endReason: 'interrupted', endedAt: new Date(this.clock()) }, { where: { endedAt: null } });
        });
        if (oblecto) {
            this.timer = setInterval(() => { void this.sample(); }, 15000);
            this.timer.unref();
        }
    }
    /** Serialize database transactions, including SQLite's single writer. Never reject into playback. */
    private safe(work: () => Promise<void>): Promise<void> {
        if (this.closed) return Promise.resolve();
        if (this.pending >= 1024) {
            if (!this.degraded) logger.warn('Statistics collection queue is full; some activity was dropped');
            this.degraded = true;
            this.lastFailureAt = new Date(this.clock()).toISOString();
            return Promise.resolve();
        }
        this.pending++;
        const next = this.writes.then(work).catch((error: unknown) => {
            this.degraded = true;
            this.lastFailureAt = new Date(this.clock()).toISOString();
            logger.warn('Statistics collection failed', error);
        }).finally(() => { this.pending--; });
        this.writes = next;
        return next;
    }
    async identify(file: File): Promise<Identity> {
        const movie = await Movie.findOne({ include: [{ association: 'Files', where: { id: file.id } }] });
        if (movie) return {
            itemType: 'movie', itemId: movie.id, title: movie.movieName ?? 'Movie'
        };
        const episode = await Episode.findOne({ include: [{ association: 'Files', where: { id: file.id } }] });
        return episode ? {
            itemType: 'episode', itemId: episode.id, title: episode.episodeName ?? 'Episode'
        } : {
            itemType: 'file', itemId: null, title: 'Unidentified media'
        };
    }
    begin(id: string, userId: number | null, file: File | null, client: string, position = 0, identity?: Identity): Promise<void> {
        if (userId === null) return Promise.resolve();
        const now = this.clock();
        return this.safe(async () => {
            const media = identity ?? (file ? await this.identify(file) : {
                itemType: 'file', itemId: null, title: 'Unidentified media'
            });
            await ViewingSession.findOrCreate({
                where: { id },
                defaults: {
                    id,
                    userId,
                    ...media,
                    fileId: file?.id ?? null,
                    client,
                    duration: file?.duration ?? 0,
                    startedAt: new Date(now),
                    lastReportAt: new Date(now),
                    quality: 'estimated',
                    checkpoint: JSON.stringify(initialCheckpoint(now, position))
                }
            });
        });
    }
    report(id: string, report: StatisticsReport, duration: number, method: Method): Promise<void> {
        const now = this.clock();
        return this.safe(async () => {
            await this.database.transaction(async transaction => {
                const row = await ViewingSession.findByPk(id, { transaction });
                if (!row || row.getDataValue('endedAt')) return;
                const previous = JSON.parse(row.getDataValue('checkpoint')) as Checkpoint;
                const result = account(previous, report, now, duration);
                if (!result) return;
                const first = !row.getDataValue('firstPlayedAt') && result.seconds > 0;
                const completed = !row.getDataValue('completedAt') && result.completed;
                const repeated = first && await ViewingSession.count({
                    where: {
                        userId: row.getDataValue('userId'),
                        itemType: row.getDataValue('itemType'),
                        itemId: row.getDataValue('itemId'),
                        ...(row.getDataValue('itemId') === null ? { fileId: row.getDataValue('fileId') } : {}),
                        id: { [Op.ne]: id },
                        firstPlayedAt: { [Op.ne]: null }
                    },
                    transaction
                }) > 0;
                result.checkpoint.method = method;
                const day = new Date(now).toISOString().slice(0, 10);
                const slices = splitDays(previous.at, now, result.seconds);
                if (!slices.some(slice => slice.day === day)) slices.push({ day, seconds: 0 });
                for (const slice of slices) {
                    const key = `${id}:${slice.day}`;
                    const [daily] = await ViewingDay.findOrCreate({
                        where: { id: key },
                        transaction,
                        defaults: {
                            id: key,
                            sessionId: id,
                            day: slice.day,
                            watchSeconds: 0,
                            estimatedSeconds: 0,
                            directSeconds: 0,
                            remuxSeconds: 0,
                            transcodeSeconds: 0,
                            unknownSeconds: 0,
                            plays: 0,
                            completions: 0,
                            repeatPlays: 0
                        }
                    });
                    const values: Partial<DailyAttributes> = {
                        watchSeconds: daily.getDataValue('watchSeconds') + slice.seconds,
                        estimatedSeconds: daily.getDataValue('estimatedSeconds') + (result.quality === 'estimated' ? slice.seconds : 0),
                        plays: daily.getDataValue('plays') + (first && slice.day === day ? 1 : 0),
                        completions: daily.getDataValue('completions') + (completed && slice.day === day ? 1 : 0),
                        repeatPlays: daily.getDataValue('repeatPlays') + (repeated && slice.day === day ? 1 : 0)
                    };
                    const field = `${previous.method === 'unknown' ? method : previous.method}Seconds` as const;
                    values[field] = daily.getDataValue(field) + slice.seconds;
                    await daily.update(values, { transaction });
                }
                await row.update({
                    duration,
                    lastReportAt: new Date(now),
                    watchSeconds: row.getDataValue('watchSeconds') + result.seconds,
                    checkpoint: JSON.stringify(result.checkpoint),
                    firstPlayedAt: first ? new Date(now) : row.getDataValue('firstPlayedAt'),
                    completedAt: completed ? new Date(now) : row.getDataValue('completedAt'),
                    quality: row.getDataValue('watchSeconds') > 0 && row.getDataValue('quality') !== result.quality ? 'mixed' : result.quality,
                    bufferingReports: report.buffering === undefined ? row.getDataValue('bufferingReports') : (row.getDataValue('bufferingReports') ?? 0) + (report.buffering && !previous.buffering ? 1 : 0)
                }, { transaction });
            });
        });
    }
    /** A stream revision establishes a new position baseline without counting a seek. */
    revise(id: string, position: number, revision: number, method: Method): Promise<void> {
        const now = this.clock();
        return this.safe(async () => {
            const row = await ViewingSession.findByPk(id);
            if (!row || row.getDataValue('endedAt')) return;
            const checkpoint = JSON.parse(row.getDataValue('checkpoint')) as Checkpoint;
            await row.update({
                checkpoint: JSON.stringify({
                    ...checkpoint, position, revision, method, at: now, paused: true
                })
            });
        });
    }
    failure(id: string, code: string): Promise<void> {
        return this.safe(async () => { await ViewingSession.update({ failure: code.slice(0, 100) }, { where: { id, endedAt: null } }); });
    }
    end(id: string, reason = 'stopped'): Promise<void> {
        const now = this.clock();
        return this.safe(async () => { await ViewingSession.update({ endedAt: new Date(now), endReason: reason }, { where: { id, endedAt: null } }); });
    }
    sample(gauges?: Gauges): Promise<void> {
        const now = this.clock();
        return this.safe(async () => {
            const idle = this.oblecto?.config.streaming?.idleTimeoutMs ?? 1800000;
            await ViewingSession.update({ endedAt: new Date(now), endReason: 'timeout' }, { where: { endedAt: null, lastReportAt: { [Op.lt]: new Date(now - idle) } } });
            if (!gauges && this.oblecto) {
                const sessions = [...this.oblecto.playback.sessions.values()];
                const active = await ViewingSession.findAll({ where: { endedAt: null, lastReportAt: { [Op.gte]: new Date(now - 60000) } } });
                const users = new Set(active.filter(row => {
                    const checkpoint = JSON.parse(row.getDataValue('checkpoint')) as Checkpoint;
                    return !checkpoint.paused && !checkpoint.buffering;
                }).map(row => row.getDataValue('userId')));
                gauges = {
                    viewers: users.size,
                    sessions: sessions.length,
                    direct: sessions.filter(s => s.plan.method === 'direct').length,
                    remux: sessions.filter(s => s.plan.method === 'remux').length,
                    transcode: sessions.filter(s => s.plan.method === 'transcode').length,
                    encoders: this.oblecto.playback.scheduler.active,
                    queue: this.oblecto.playback.scheduler.queued,
                    cacheBytes: this.oblecto.playback.cache.bytes
                };
            }
            if (!gauges) return;
            const sample = gauges;
            await this.database.transaction(async transaction => {
                // Update both resolutions in one transaction; pruning never needs to reaggregate.
                for (const [resolution, width] of [['minute', 60000], ['hour', 3600000]] as const) {
                    const bucket = new Date(Math.floor(now / width) * width);
                    const id = `${resolution}:${bucket.toISOString()}`;
                    const row = await PlaybackHealth.findByPk(id, { transaction });
                    const data: HealthData = row ? JSON.parse(row.getDataValue('data')) as HealthData : {
                        samples: 0, sums: { ...sample }, peaks: { ...sample }
                    };
                    if (data.samples > 0) {
                        for (const name of Object.keys(sample) as Array<keyof Gauges>) {
                            data.sums[name] += sample[name];
                            data.peaks[name] = Math.max(data.peaks[name], sample[name]);
                        }
                    }
                    data.samples++;
                    await PlaybackHealth.upsert({
                        id, resolution, bucket, data: JSON.stringify(data)
                    }, { transaction });
                }
            });
            if (now - this.lastPrune >= 3600000) {
                await PlaybackHealth.destroy({ where: { resolution: 'minute', bucket: { [Op.lt]: new Date(now - 30 * 86400000) } } });
                this.lastPrune = now;
            }
        });
    }
    async settled(): Promise<void> { await this.writes; }
    async close(): Promise<void> {
        clearInterval(this.timer);
        await this.safe(async () => {
            await ViewingSession.update({ endedAt: new Date(this.clock()), endReason: 'shutdown' }, { where: { endedAt: null } });
        });
        this.closed = true;
        await this.writes;
    }
}
