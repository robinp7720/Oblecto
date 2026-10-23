import { col, fn, type FindOptions, type IncludeOptions, type Model, type ModelStatic, type Sequelize, type Transaction } from 'sequelize';
import type { BrowseParams } from './browse.js';

export type BrowseFacets = { genres: string[]; years: number[] };
type Entry = { dependencies: Set<string>; userId: number; expires: number; value: Promise<BrowseFacets> };
const caches = new WeakMap<Sequelize, FacetCache>();
const USER_MODELS = new Set(['TrackMovie', 'TrackEpisode', 'UserFavourite', 'UserWatchlist', 'UserSeriesWatchlist']);

/** Bounded per-database cache. Pending reads are shared and never republished after invalidation. */
class FacetCache {
    private entries = new Map<string, Entry>();

    constructor(database: Sequelize) {
        for (const model of Object.values(database.models)) {
            const invalidate = (transaction?: Transaction | null, userId?: number): void => {
                const clear = (): void => {
                    for (const [key, entry] of this.entries) {
                        if (entry.dependencies.has(model.name) && (userId === undefined || entry.userId === userId)) this.entries.delete(key);
                    }
                };
                clear();
                // A concurrent read can finish before a transaction becomes visible.
                transaction?.afterCommit(clear);
            };
            for (const event of ['afterSave', 'afterDestroy', 'afterRestore'] as const) {
                model.addHook(event, (instance: Model, options: { transaction?: Transaction | null }) => {
                    const userId: unknown = USER_MODELS.has(model.name) ? instance.get('userId') : undefined;
                    invalidate(options.transaction, typeof userId === 'number' ? userId : undefined);
                });
            }
            model.addHook('afterBulkCreate', (_instances, options) => { invalidate(options.transaction); });
            for (const event of ['afterBulkUpdate', 'afterBulkDestroy', 'afterBulkRestore'] as const) {
                model.addHook(event, (options: { transaction?: Transaction | null }) => { invalidate(options.transaction); });
            }
            model.addHook('afterUpsert', (_result, options) => { invalidate(options.transaction); });
        }
    }

    get(key: string, userId: number, dependencies: Set<string>, load: () => Promise<BrowseFacets>): Promise<BrowseFacets> {
        const existing = this.entries.get(key);
        if (existing && existing.expires > Date.now()) {
            this.entries.delete(key);
            this.entries.set(key, existing);
            return existing.value;
        }
        this.entries.delete(key);
        while (this.entries.size >= 128) this.entries.delete(this.entries.keys().next().value!);
        const entry: Entry = {
            userId,
            dependencies,
            expires: Date.now() + 30000,
            value: load()
        };
        this.entries.set(key, entry);
        void entry.value.catch(() => {
            if (this.entries.get(key) === entry) this.entries.delete(key);
        });
        return entry.value;
    }
}

export function normalizeGenres(value: unknown): string[] {
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(String).map(item => item.trim()).filter(Boolean);
    } catch { /* Older libraries stored comma-separated genres. */ }
    return value.split(',').map(item => item.trim()).filter(Boolean);
}

function projectionOnly(item: IncludeOptions): IncludeOptions {
    return {
        ...item,
        attributes: [],
        ...(item.through ? { through: { ...item.through, attributes: [] } } : {}),
        ...(item.include ? { include: (item.include as IncludeOptions[]).map(projectionOnly) } : {})
    };
}

/** Aggregate distinct genre/year pairs in SQL, without hydrating titles or joined models. */
export function browseFacets(
    model: ModelStatic<Model>, params: BrowseParams, userId: number, options: FindOptions,
    genreField: string, dateField: string
): Promise<BrowseFacets> {
    const database = model.sequelize!;
    let cache = caches.get(database);
    if (!cache) {
        cache = new FacetCache(database);
        caches.set(database, cache);
    }
    const movie = model.name === 'Movie';
    const dependencies = new Set([model.name]);
    if (params.watched !== 'all') {
        dependencies.add(movie ? 'TrackMovie' : 'TrackEpisode');
        if (!movie) dependencies.add('Episode');
    }
    if (params.list === 'favourites') dependencies.add('UserFavourite');
    if (params.list === 'watchlist') dependencies.add(movie ? 'UserWatchlist' : 'UserSeriesWatchlist');
    if (params.personId !== null) dependencies.add(movie ? 'MovieCredit' : 'SeriesCredit');
    if (params.libraryPath !== null) {
        for (const name of movie ? ['File', 'MovieFiles'] : ['File', 'Episode', 'EpisodeFiles']) dependencies.add(name);
    }
    return cache.get(`${model.name}:${userId}:${params.filterHash}`, userId, dependencies, async () => {
        const genre = col(`${model.name}.${genreField}`);
        const year = fn('SUBSTR', col(`${model.name}.${dateField}`), 1, 4);
        const include = (options.include as IncludeOptions[]).filter(item => item.required === true || params.watched !== 'all').map(projectionOnly);
        const rows = await model.findAll({
            ...options,
            include,
            attributes: [[genre, 'genre'], [year, 'year']],
            // Preserve differently cased genre labels on case-insensitive MySQL/MariaDB collations.
            group: [genre, year, ...(database.getDialect() === 'sqlite' ? [] : [fn('HEX', genre)])],
            raw: true
        }) as unknown as Array<{ genre: string | null; year: string | null }>;
        const genres = new Set<string>();
        const years = new Set<number>();
        for (const row of rows) {
            for (const value of normalizeGenres(row.genre)) genres.add(value);
            const value = parseInt(String(row.year ?? ''), 10);
            if (Number.isInteger(value) && value !== 0) years.add(value);
        }
        return { genres: [...genres].sort((a, b) => a.localeCompare(b)), years: [...years].sort((a, b) => a - b) };
    });
}
