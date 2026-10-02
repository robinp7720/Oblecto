import { randomUUID } from 'node:crypto';
import { Op, Transaction } from 'sequelize';
import type { Model, ModelStatic } from 'sequelize';
import { FederationRecord } from '../../models/federationRecord.js';
import { File } from '../../models/file.js';
import { Movie } from '../../models/movie.js';
import { Episode } from '../../models/episode.js';
import { Series } from '../../models/series.js';
import { MovieFiles } from '../../models/movieFiles.js';
import { EpisodeFiles } from '../../models/episodeFiles.js';
import { record, text } from './protocol.js';
const fileFields = ['name', 'extension', 'container', 'videoCodec', 'audioCodec', 'duration', 'size'];
const movieFields = ['tmdbid', 'imdbid', 'movieName', 'originalName', 'overview', 'releaseDate', 'genres', 'runtime'];
const seriesFields = ['tmdbid', 'tvdbid', 'imdbid', 'seriesName', 'overview', 'firstAired', 'genre'];
const episodeFields = ['tmdbid', 'tvdbid', 'imdbid', 'episodeName', 'overview', 'airedSeason', 'airedEpisodeNumber', 'firstAired', 'runtime'];
export type Metadata = Record<string, string | number | null>;
export interface CatalogFile {
    id: string;
    metadata: Metadata;
    movies: Metadata[];
    episodes: Array<{
        id: string;
        metadata: Metadata;
        series: Metadata;
    }>;
}
function pick(source: Record<string, unknown>, fields: string[]): Metadata {
    const result: Metadata = {};
    for (const key of fields) {
        const value = source[key];
        if (value === undefined || value === null)
            continue;
        if (['duration', 'size', 'runtime', 'tmdbid', 'tvdbid'].includes(key) && typeof value !== 'number')
            throw new Error('Expected a numeric catalog field');
        if (!['duration', 'size', 'runtime', 'tmdbid', 'tvdbid', 'airedSeason', 'airedEpisodeNumber'].includes(key) && typeof value !== 'string')
            throw new Error('Expected a text catalog field');
        if (typeof value !== 'string' && typeof value !== 'number')
            throw new Error('Invalid catalog field');
        if (typeof value === 'number' && (!Number.isFinite(value) || value < 0))
            throw new Error('Invalid catalog number');
        if (typeof value === 'string' && (value.length > 20000 || value.includes('\0')))
            throw new Error('Invalid catalog text');
        if (['tmdbid', 'tvdbid'].includes(key) && (!Number.isSafeInteger(value) || Number(value) <= 0))
            throw new Error('Invalid provider identity');
        result[key] = value;
    }
    return result;
}
export function validateFile(input: unknown): CatalogFile {
    const value = record(input);
    const id = text(value.id, 64);
    if (!/^\d+$/.test(id))
        throw new Error('Invalid remote file identity');
    if (!Array.isArray(value.movies) || !Array.isArray(value.episodes) || value.movies.length + value.episodes.length === 0 || value.movies.length + value.episodes.length > 100)
        throw new Error('Invalid media associations');
    const movies = value.movies.map(item => { const obj = record(item); return { ...pick(obj, movieFields), id: text(obj.id, 64) }; });
    const episodes = value.episodes.map(item => {
        const obj = record(item);
        const series = record(obj.series);
        const metadata = pick(record(obj.metadata), episodeFields);
        if (metadata.airedSeason === undefined || metadata.airedEpisodeNumber === undefined)
            throw new Error('Missing episode numbering');
        return {
            metadata, id: text(obj.id, 64), series: { ...pick(series, seriesFields), id: text(series.id, 64) }
        };
    });
    return {
        id, metadata: pick(record(value.metadata), fileFields), movies, episodes
    };
}
/** One stable export captured transactionally, then served in bounded pages. */
export async function createSnapshot(cancelled: () => boolean = () => false): Promise<{
    snapshot: string;
    count: number;
}> {
    const snapshot = randomUUID();
    let count = 0;
    await File.sequelize!.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
        let after = 0;
        for (;;) {
            const files = await File.findAll({
                where: { [Op.and]: [{ [Op.or]: [{ host: 'local' }, { host: null }, { host: '' }] }, { id: { [Op.gt]: after } }] }, order: [['id', 'ASC']], limit: 100, transaction
            });
            if (!files.length)
                break;
            for (const file of files) {
                if (cancelled())
                    throw new Error('Snapshot cancelled');
                after = file.id;
                const movies = await Movie.findAll({
                    include: [
                        {
                            model: File, where: { id: file.id }, attributes: []
                        }
                    ],
                    transaction
                });
                const episodes = await Episode.findAll({
                    include: [
                        {
                            model: File, where: { id: file.id }, attributes: []
                        }, Series
                    ],
                    transaction
                });
                if (!movies.length && !episodes.length)
                    continue;
                const payload = {
                    id: String(file.id),
                    metadata: pick(file.get(), fileFields),
                    movies: movies.map(movie => ({ ...pick(movie.get(), movieFields), id: String(movie.id) })),
                    episodes: episodes.map(episode => ({
                        metadata: pick(episode.get(), episodeFields), id: String(episode.id), series: { ...pick((episode.get('Series') as Series).get(), seriesFields), id: String((episode.get('Series') as Series).id) }
                    }))
                };
                const value = JSON.stringify(validateFile(payload));
                if (Buffer.byteLength(value) > 48000)
                    throw new Error('Catalog record exceeds protocol limit');
                await FederationRecord.create({
                    scope: `export:${snapshot}`, key: String(count++).padStart(12, '0'), value, expires: Date.now() + 3600000
                }, { transaction });
            }
        }
    });
    return { snapshot, count };
}
export async function snapshotPage(snapshot: string, offset: number): Promise<unknown[]> {
    const rows = await FederationRecord.findAll({
        where: { scope: `export:${snapshot}`, key: { [Op.gte]: String(offset).padStart(12, '0') } }, order: [['key', 'ASC']], limit: 100
    });
    const page: unknown[] = [];
    let size = 0;
    for (const row of rows) {
        size += Buffer.byteLength(row.value);
        if (size > 48000 && page.length)
            break;
        page.push(JSON.parse(row.value) as unknown);
    }
    return page;
}
/** Provider identities merge with local media; otherwise retain a durable peer-scoped identity. */
async function resolveMedia(model: ModelStatic<Model>, kind: string, host: string, metadata: Metadata, transaction: Transaction, extra: Record<string, unknown> = {}, added: Array<{
    kind: string;
    id: number;
}> = []): Promise<number> {
    const remoteId = String(metadata.id);
    const fields = { ...metadata, ...extra };
    delete fields.id;
    const identities = ['tmdbid', 'tvdbid', 'imdbid'].filter(key => fields[key] !== undefined).map(key => ({ [key]: fields[key] }));
    let existing: Model | null = identities.length ? await model.findOne({ where: { [Op.or]: identities }, transaction }) : null;
    if (!existing && kind === 'episode')
        existing = await model.findOne({
            where: {
                SeriesId: extra.SeriesId, airedSeason: String(fields.airedSeason), airedEpisodeNumber: String(fields.airedEpisodeNumber)
            },
            transaction
        });
    const scope = `map:${host}:${kind}`;
    if (!existing) {
        const saved = await FederationRecord.findOne({ where: { scope, key: remoteId }, transaction });
        if (saved)
            existing = await model.findByPk(Number(saved.value), { transaction });
    }
    if (!existing) {
        existing = await model.create(fields, { transaction });
        added.push({ kind, id: Number(existing.get('id')) });
    }
    else {
        // Shared provider matches keep curated fields; a peer-owned item follows its origin.
        const owned = await FederationRecord.findOne({
            where: {
                scope: `owner:${kind}`, key: String(existing.get('id')), value: host
            },
            transaction
        });
        const missing = Object.fromEntries(Object.entries(fields).filter(([key]) => existing!.get(key) === null || existing!.get(key) === undefined));
        const localFiles = {
            model: File, where: { [Op.or]: [{ host: 'local' }, { host: null }, { host: '' }] }, attributes: [], required: true
        };
        const local = owned ? await model.findOne({
            where: { id: existing.get('id') },
            include: kind === 'series' ? [
                {
                    model: Episode, required: true, include: [localFiles]
                }
            ] : [localFiles],
            transaction
        }) : null;
        await existing.update(owned && !local ? fields : missing, { transaction });
    }
    const id = Number(existing.get('id'));
    await FederationRecord.upsert({
        scope: `retain:${kind}`, key: String(id), value: 'true', expires: null
    }, { transaction });
    if (added.some(item => item.kind === kind && item.id === id))
        await FederationRecord.upsert({
            scope: `owner:${kind}`, key: String(id), value: host, expires: null
        }, { transaction });
    await FederationRecord.upsert({
        scope, key: remoteId, value: String(id), expires: null
    }, { transaction });
    return id;
}
export async function applySnapshot(host: string, snapshot: string, count: number, cancelled: () => boolean): Promise<Array<{
    kind: string;
    id: number;
}>> {
    const added: Array<{
        kind: string;
        id: number;
    }> = [];
    await File.sequelize!.transaction(async (transaction) => {
        const scope = `import:${snapshot}`;
        if (await FederationRecord.count({ where: { scope }, transaction }) !== count)
            throw new Error('Incomplete snapshot');
        const seen = new Set<string>();
        const applied = new Set<number>();
        let after = '';
        for (;;) {
            const rows = await FederationRecord.findAll({
                where: { scope, key: { [Op.gt]: after } }, order: [['key', 'ASC']], limit: 100, transaction
            });
            if (!rows.length)
                break;
            for (const row of rows) {
                if (cancelled())
                    throw new Error('Synchronization cancelled');
                after = row.key;
                const input = validateFile(JSON.parse(row.value));
                if (seen.has(input.id))
                    throw new Error('Duplicate remote file identity');
                seen.add(input.id);
                const [file] = await File.findOrCreate({
                    where: { host, path: input.id },
                    defaults: {
                        name: '', directory: '', extension: ''
                    },
                    transaction
                });
                applied.add(file.id);
                await file.update(input.metadata, { transaction });
                await MovieFiles.destroy({ where: { FileId: file.id }, transaction });
                await EpisodeFiles.destroy({ where: { FileId: file.id }, transaction });
                for (const movie of input.movies) {
                    const MovieId = await resolveMedia(Movie, 'movie', host, movie, transaction, {}, added);
                    await MovieFiles.findOrCreate({ where: { MovieId, FileId: file.id }, transaction });
                }
                for (const episode of input.episodes) {
                    const SeriesId = await resolveMedia(Series, 'series', host, episode.series, transaction, {}, added);
                    const metadata = { ...episode.metadata, id: episode.id };
                    const EpisodeId = await resolveMedia(Episode, 'episode', host, metadata, transaction, { SeriesId }, added);
                    await EpisodeFiles.findOrCreate({ where: { EpisodeId, FileId: file.id }, transaction });
                }
            }
        }
        const previous = await File.findAll({ where: { host }, transaction });
        for (const file of previous)
            if (!applied.has(file.id)) {
                await MovieFiles.destroy({ where: { FileId: file.id }, transaction });
                await EpisodeFiles.destroy({ where: { FileId: file.id }, transaction });
                await file.destroy({ transaction });
            }
        if (cancelled())
            throw new Error('Synchronization cancelled');
        await FederationRecord.destroy({ where: { scope }, transaction });
    });
    return added;
}
/** Retain identities/watch history for items that once belonged to a federated catalog. */
export async function federatedMediaIds(kind: 'movie' | 'episode' | 'series'): Promise<Set<number>> {
    if (!FederationRecord.sequelize || FederationRecord.sequelize !== File.sequelize)
        return new Set();
    const records = await FederationRecord.findAll({ where: { [Op.or]: [{ scope: { [Op.like]: `map:%:${kind}` } }, { scope: `retain:${kind}` }] } });
    return new Set(records.map(item => Number(item.scope.startsWith('retain:') ? item.key : item.value)));
}
