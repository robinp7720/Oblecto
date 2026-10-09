import { Op, QueryTypes, type Sequelize, type WhereOptions } from 'sequelize';
import { ViewingSession, PlaybackHealth, StatisticsMeta, type ViewingAttributes } from '../../models/statistics.js';
import type { HealthData, Gauges } from './StatisticsService.js';
import errors from '../../submodules/REST/errors.js';

export interface Period { from: string; to: string; userId?: number }
const day = (date: Date): string => date.toISOString().slice(0, 10);
export function readPeriod(query: Record<string, unknown>, userId?: number, now = new Date()): Period {
    if ((query.from !== undefined && typeof query.from !== 'string') || (query.to !== undefined && typeof query.to !== 'string')) throw new errors.BadRequestError('Dates must be strings');
    const to = typeof query.to === 'string' ? query.to : day(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to) || !Number.isFinite(Date.parse(to)) || day(new Date(to)) !== to) throw new errors.BadRequestError('Dates must be valid YYYY-MM-DD UTC dates');
    const from = typeof query.from === 'string' ? query.from : day(new Date(Date.parse(to) - 30 * 86400000));
    for (const value of [from, to]) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || day(new Date(value)) !== value) throw new errors.BadRequestError('Dates must be valid YYYY-MM-DD UTC dates');
    }
    if (Date.parse(to) - Date.parse(from) > 366 * 86400000) throw new errors.BadRequestError('Choose a period of at most 366 days');
    if (from >= to) throw new errors.BadRequestError('from must be before to');
    return {
        from, to, userId
    };
}
const fields = ['watchSeconds', 'estimatedSeconds', 'directSeconds', 'remuxSeconds', 'transcodeSeconds', 'unknownSeconds', 'plays', 'completions', 'repeatPlays'] as const;
export class StatisticsQueries {
    constructor(private readonly database: Sequelize) { }
    private quote(name: string): string {
        const generator = this.database.getQueryInterface().queryGenerator as { quoteIdentifier(value: string): string };
        return generator.quoteIdentifier(name);
    }
    async summary(period: Period): Promise<Record<string, unknown>> {
        const q = (name: string): string => this.quote(name);
        const sums = fields.map(field => `COALESCE(SUM(d.${q(field)}),0) AS ${q(field)}`).join(',');
        const join = `FROM ${q('ViewingDays')} d JOIN ${q('ViewingSessions')} s ON s.${q('id')} = d.${q('sessionId')}
            WHERE d.${q('day')} >= :from AND d.${q('day')} < :to ${period.userId === undefined ? '' : `AND s.${q('userId')} = :userId`}`;
        const select = (sql: string): Promise<Record<string, unknown>[]> => this.database.query<Record<string, unknown>>(sql, { replacements: { ...period }, type: QueryTypes.SELECT });
        const [totals, daily, titles, kinds, users, meta] = await Promise.all([
            select(`SELECT ${sums} ${join}`),
            select(`SELECT d.${q('day')} AS ${q('day')}, ${sums} ${join} GROUP BY d.${q('day')} ORDER BY d.${q('day')}`),
            select(`SELECT s.${q('itemType')} AS ${q('itemType')}, s.${q('itemId')} AS ${q('itemId')}, MAX(s.${q('title')}) AS ${q('title')}, ${sums} ${join}
                GROUP BY s.${q('itemType')}, s.${q('itemId')} ORDER BY ${q('watchSeconds')} DESC LIMIT 20`),
            select(`SELECT s.${q('itemType')} AS ${q('itemType')}, ${sums} ${join} GROUP BY s.${q('itemType')}`),
            period.userId === undefined ? select(`SELECT s.${q('userId')} AS ${q('userId')}, (SELECT u.${q('username')} FROM ${q('Users')} u WHERE u.${q('id')} = s.${q('userId')}) AS ${q('username')}, ${sums} ${join} GROUP BY s.${q('userId')} ORDER BY ${q('watchSeconds')} DESC`) : Promise.resolve([]),
            StatisticsMeta.findByPk('trackingStartedAt')
        ]);
        return {
            period, totals: totals[0], daily, titles, kinds, users, trackingStartedAt: meta?.getDataValue('value') ?? null, timezone: 'UTC'
        };
    }
    async history(period: Period, query: Record<string, unknown>): Promise<Record<string, unknown>> {
        const limit = query.limit === undefined ? 50 : Number(query.limit);
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new errors.BadRequestError('limit must be between 1 and 100');
        let where: WhereOptions<ViewingAttributes> = {
            startedAt: { [Op.gte]: new Date(period.from), [Op.lt]: new Date(period.to) },
            ...(period.userId === undefined ? {} : { userId: period.userId })
        };
        if (query.cursor !== undefined) {
            try {
                if (typeof query.cursor !== 'string' || query.cursor.length > 1024) throw new Error();
                const cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString()) as { at: string; id: string; from: string; to: string; userId?: number };
                if (cursor.from !== period.from || cursor.to !== period.to || cursor.userId !== period.userId ||
                    typeof cursor.id !== 'string' || cursor.id.length > 64 || !Number.isFinite(Date.parse(cursor.at))) throw new Error();
                where = { [Op.and]: [where, { [Op.or]: [{ startedAt: { [Op.lt]: new Date(cursor.at) } }, { startedAt: new Date(cursor.at), id: { [Op.lt]: cursor.id } }] }] };
            } catch { throw new errors.BadRequestError('Invalid history cursor'); }
        }
        const rows = await ViewingSession.findAll({
            where, order: [['startedAt', 'DESC'], ['id', 'DESC']], limit: limit + 1, attributes: { exclude: ['checkpoint'] }
        });
        const items = rows.slice(0, limit).map(row => row.toJSON());
        const last = items.at(-1);
        return {
            items,
            nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({
                ...period, at: last.startedAt.toISOString(), id: last.id
            })).toString('base64url') : null
        };
    }
    async library(): Promise<Record<string, unknown>> {
        const q = (name: string): string => this.quote(name);
        const count = async (table: string): Promise<number> => {
            const [row] = await this.database.query<{ count: number }>(`SELECT COUNT(*) AS ${q('count')} FROM ${q(table)}`, { type: QueryTypes.SELECT });
            return Number(row.count);
        };
        const [movies, series, episodes, files, sizes] = await Promise.all([
            count('Movies'), count('Series'), count('Episodes'), count('Files'),
            this.database.query<Record<string, number>>(`SELECT
                COALESCE(SUM(CASE WHEN ${q('host')} IS NULL OR ${q('host')} = 'local' OR ${q('host')} = '' THEN COALESCE(${q('size')},0) ELSE 0 END),0) AS ${q('localBytes')},
                SUM(CASE WHEN ${q('host')} IS NOT NULL AND ${q('host')} <> 'local' AND ${q('host')} <> '' THEN 1 ELSE 0 END) AS ${q('remoteFiles')},
                SUM(CASE WHEN ${q('size')} IS NULL THEN 1 ELSE 0 END) AS ${q('missingSize')},
                SUM(CASE WHEN ${q('problematic')} = 1 THEN 1 ELSE 0 END) AS ${q('problematicFiles')}
                FROM ${q('Files')}`, { type: QueryTypes.SELECT })
        ]);
        return {
            movies, series, episodes, files, ...Object.fromEntries(Object.entries(sizes[0]).map(([key, value]) => [key, Number(value ?? 0)]))
        };
    }
    async health(period: Period): Promise<Record<string, unknown>> {
        const q = (name: string): string => this.quote(name);
        const resolution = Date.parse(period.from) < Date.now() - 30 * 86400000 || Date.parse(period.to) - Date.parse(period.from) > 7 * 86400000 ? 'hour' : 'minute';
        const rows = await PlaybackHealth.findAll({ where: { resolution, bucket: { [Op.gte]: new Date(period.from), [Op.lt]: new Date(period.to) } }, order: [['bucket', 'ASC']] });
        const buckets = rows.map(row => {
            const data = JSON.parse(row.getDataValue('data')) as HealthData;
            const means = Object.fromEntries(Object.entries(data.sums).map(([key, value]) => [key, value / data.samples])) as Gauges;
            return {
                at: row.getDataValue('bucket'), samples: data.samples, means, peaks: data.peaks
            };
        });
        const [failures] = await this.database.query<Record<string, number>>(`SELECT COUNT(*) AS ${q('attempts')},
            SUM(CASE WHEN ${q('failure')} IS NOT NULL THEN 1 ELSE 0 END) AS ${q('failedSessions')},
            SUM(CASE WHEN ${q('failure')} IS NOT NULL AND ${q('firstPlayedAt')} IS NULL THEN 1 ELSE 0 END) AS ${q('failedAttempts')},
            SUM(${q('bufferingReports')}) AS ${q('bufferingReports')},
            SUM(CASE WHEN ${q('bufferingReports')} IS NOT NULL THEN 1 ELSE 0 END) AS ${q('bufferingKnownSessions')}
            FROM ${q('ViewingSessions')} WHERE ${q('startedAt')} >= :from AND ${q('startedAt')} < :to`, { replacements: { from: new Date(period.from), to: new Date(period.to) }, type: QueryTypes.SELECT });
        return {
            resolution, buckets, failures: Object.fromEntries(Object.entries(failures).map(([key, value]) => [key, value === null ? null : Number(value)]))
        };
    }
}
