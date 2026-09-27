/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
// One engine behind GET /Items and GET /Users/{id}/Items: which items a query means, in which order,
// and which page of them. Every listing a Jellyfin app shows (library grids, seasons, episodes,
// filters, sort menus) comes through here.
import { Op, fn, col, literal, type Includeable, type Order, type Sequelize, type WhereOptions } from 'sequelize';
import { Movie } from '../../../models/movie.js';
import { Series } from '../../../models/series.js';
import { Episode } from '../../../models/episode.js';
import { File } from '../../../models/file.js';
import { Stream } from '../../../models/stream.js';
import { TrackMovie } from '../../../models/trackMovie.js';
import { TrackEpisode } from '../../../models/trackEpisode.js';
import { MovieCredit } from '../../../models/movieCredit.js';
import { SeriesCredit } from '../../../models/seriesCredit.js';
import { EpisodeCredit } from '../../../models/episodeCredit.js';
import { containsText } from '../../common/textSearch.js';
import { genreCondition } from '../../common/genres.js';
import { WATCHED_PROGRESS } from '../../playback/progress.js';
import { formatMediaItem, parseId, parseUuid, type MediaItem } from '../helpers.js';
import { isLibraryView, type LibraryViewId } from '../views.js';
import { getRequestList, getRequestValue } from './requestUtils.js';
import { decorateItems } from './itemDetails.js';
import { genreNames, listBoxSets, visibleSet } from './library.js';

import type EmbyEmulation from '../index.js';
import type { EmbyRequest } from './index.js';

export type ItemKind = 'movie' | 'series' | 'season' | 'episode' | 'boxset';

export type ItemsResult = {
    Items: Record<string, unknown>[];
    TotalRecordCount: number;
    StartIndex: number;
};

// No Jellyfin client pages further than this in one request; it bounds a request without a Limit.
const MAX_LIMIT = 2000;

const JELLYFIN_TYPES: Record<string, ItemKind> = {
    movie: 'movie',
    series: 'series',
    season: 'season',
    episode: 'episode',
    boxset: 'boxset'
};

export type ItemQuery = {
    userId: number | null;
    kinds: ItemKind[];
    startIndex: number;
    limit: number;
    searchTerm: string;
    sortBy: string[];
    descending: boolean;
    filters: Set<string>;
    isPlayed: boolean | null;
    ids: Map<ItemKind, number[]> | null;
    years: number[];
    genres: string[];
    genreIds: string[];
    personIds: number[];
    boxSetId: number | null;
    seriesId: number | null;
    season: number | null;
};

const empty = (startIndex = 0): ItemsResult => ({
    Items: [], TotalRecordCount: 0, StartIndex: startIndex
});

const readBoolean = (value: string | undefined): boolean | null => {
    if (value === undefined || value === '') return null;
    return value.toLowerCase() === 'true';
};

/** The signed-in user. The session guard sets it; the id in the request is pinned to it too. */
export const requestUserId = (req: EmbyRequest): number | null => {
    if (req.embyUserId) return req.embyUserId;

    const raw = getRequestValue(req, 'UserId') ?? (req.params as Record<string, string> | undefined)?.userid;
    const parsed = raw ? parseUuid(String(raw)) : NaN;

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/** The item kinds a parent lists when a client does not say, and the kinds it can hold at all. */
const PARENT_KINDS: Record<LibraryViewId, { fallback: ItemKind[]; allowed: ItemKind[] }> = {
    movies: { fallback: ['movie'], allowed: ['movie', 'boxset'] },
    shows: { fallback: ['series'], allowed: ['series', 'season', 'episode'] },
    collections: { fallback: ['boxset'], allowed: ['boxset'] }
};

/**
 * Read a Jellyfin items request into what to fetch. Null when the request can only match nothing,
 * such as a parent that does not exist.
 */
export function readItemQuery(req: EmbyRequest): ItemQuery | null {
    const requested = getRequestList(req, 'IncludeItemTypes').map(type => type.toLowerCase());
    const excluded = new Set(getRequestList(req, 'ExcludeItemTypes').map(type => type.toLowerCase()));
    const parentId = getRequestValue(req, 'ParentId') ?? '';
    const recursive = readBoolean(getRequestValue(req, 'Recursive')) === true;
    const startIndex = Math.max(0, parseInt(getRequestValue(req, 'StartIndex') ?? '0', 10) || 0);
    const limitValue = parseInt(getRequestValue(req, 'Limit') ?? '', 10);
    const limit = Number.isFinite(limitValue) && limitValue >= 0 ? Math.min(limitValue, MAX_LIMIT) : MAX_LIMIT;
    const sortOrder = getRequestList(req, 'SortOrder')[0]?.toLowerCase() ?? 'ascending';
    const filters = new Set(getRequestList(req, 'Filters').map(filter => filter.toLowerCase()));

    let fallback: ItemKind[] = [];
    let allowed: ItemKind[] = ['movie', 'series', 'season', 'episode', 'boxset'];
    let seriesId: number | null = null;
    let season: number | null = null;
    let boxSetId: number | null = null;

    if (parentId) {
        if (isLibraryView(parentId)) {
            ({ fallback, allowed } = PARENT_KINDS[parentId]);
        } else {
            const parent = parseId(parentId);

            if (!Number.isFinite(parent.id)) return null;

            if (parent.type === 'series') {
                seriesId = parent.id;
                fallback = ['season'];
                allowed = ['season', 'episode'];
            } else if (parent.type === 'season') {
                seriesId = Math.floor(parent.id / 1000);
                season = parent.id % 1000;
                fallback = ['episode'];
                allowed = ['episode'];
            } else if (parent.type === 'boxset') {
                boxSetId = parent.id;
                fallback = ['movie'];
                allowed = ['movie'];
            } else {
                return null;
            }
        }
    } else if (recursive) {
        fallback = ['movie', 'series'];
    }

    const explicitSeries = getRequestValue(req, 'SeriesId');

    if (explicitSeries) {
        const parsed = parseId(explicitSeries);

        if (parsed.type !== 'series' || !Number.isFinite(parsed.id)) return null;
        seriesId = parsed.id;
    }

    let ids: Map<ItemKind, number[]> | null = null;
    const rawIds = getRequestList(req, 'Ids');

    if (rawIds.length > 0) {
        ids = new Map();

        for (const raw of rawIds) {
            const parsed = parseId(raw);
            const kind = JELLYFIN_TYPES[parsed.type];

            if (!kind || !Number.isFinite(parsed.id)) continue;
            ids.set(kind, [...(ids.get(kind) ?? []), parsed.id]);
        }

        fallback = [...ids.keys()];
    }

    const wanted = requested.length > 0
        ? requested.map(type => JELLYFIN_TYPES[type]).filter((kind): kind is ItemKind => kind !== undefined)
        : fallback;
    const kinds = [...new Set(wanted)]
        .filter(kind => allowed.includes(kind) && !excluded.has(kind))
        .filter(kind => ids === null || ids.has(kind));

    return {
        userId: requestUserId(req),
        kinds,
        startIndex,
        limit,
        searchTerm: getRequestValue(req, 'SearchTerm') ?? getRequestValue(req, 'NameStartsWith') ?? '',
        sortBy: getRequestList(req, 'SortBy').map(key => key.toLowerCase()),
        descending: sortOrder.startsWith('desc'),
        filters,
        isPlayed: readBoolean(getRequestValue(req, 'IsPlayed')),
        ids,
        years: getRequestList(req, 'Years').map(year => parseInt(year, 10)).filter(Number.isFinite),
        genres: getRequestList(req, 'Genres', '|'),
        genreIds: getRequestList(req, 'GenreIds'),
        personIds: getRequestList(req, 'PersonIds').map(id => parseId(id)).filter(id => id.type === 'person' && Number.isFinite(id.id)).map(id => id.id),
        boxSetId,
        seriesId,
        season
    };
}

// The kinds that are rows of their own table
type RowKind = 'movie' | 'series' | 'episode';

type KindSpec = {
    model: typeof Movie | typeof Series | typeof Episode;
    alias: string;
    name: string;
    date: string;
    genres: string | null;
    track: { model: typeof TrackMovie | typeof TrackEpisode; table: string; key: string } | null;
};

const SPECS: Record<RowKind, () => KindSpec> = {
    movie: () => ({
        model: Movie,
        alias: 'Movie',
        name: 'movieName',
        date: 'releaseDate',
        genres: 'genres',
        track: {
 model: TrackMovie, table: TrackMovie.getTableName() as string, key: 'movieId' 
}
    }),
    series: () => ({
        model: Series,
        alias: 'Series',
        name: 'seriesName',
        date: 'firstAired',
        genres: 'genre',
        track: null
    }),
    episode: () => ({
        model: Episode,
        alias: 'Episode',
        name: 'episodeName',
        date: 'firstAired',
        genres: null,
        track: {
 model: TrackEpisode, table: TrackEpisode.getTableName() as string, key: 'episodeId' 
}
    })
};

const quoter = (sequelize: Sequelize): (name: string) => string => {
    const generator = sequelize.getQueryInterface().queryGenerator as { quoteIdentifier(name: string): string };

    return (name: string) => generator.quoteIdentifier(name);
};

const castNumber = (sequelize: Sequelize, column: string): ReturnType<typeof fn> =>
    fn('CAST', literal(`${column} AS ${sequelize.getDialect() === 'sqlite' ? 'INTEGER' : 'SIGNED'}`));

/** SQL for "this user has watched / started / not finished this item", per kind. */
function watchCondition(sequelize: Sequelize, kind: RowKind, userId: number, state: 'played' | 'unplayed' | 'resumable'): string {
    const q = quoter(sequelize);
    const user = Number(userId);
    const watched = `${q('t')}.${q('progress')} >= ${WATCHED_PROGRESS}`;
    const started = `${q('t')}.${q('progress')} > 0 AND ${q('t')}.${q('progress')} < ${WATCHED_PROGRESS}`;

    if (kind === 'series') {
        const episodes = q(Episode.getTableName() as string);
        const tracks = q(TrackEpisode.getTableName() as string);
        const ofSeries = `${q('e')}.${q('SeriesId')} = ${q('Series')}.${q('id')}`;
        const track = (condition: string): string => `EXISTS (SELECT 1 FROM ${tracks} ${q('t')} WHERE ${q('t')}.${q('episodeId')} = ${q('e')}.${q('id')} AND ${q('t')}.${q('userId')} = ${user} AND ${condition})`;
        const unwatchedEpisode = `EXISTS (SELECT 1 FROM ${episodes} ${q('e')} WHERE ${ofSeries} AND NOT ${track(watched)})`;

        if (state === 'unplayed') return unwatchedEpisode;
        if (state === 'resumable') return `EXISTS (SELECT 1 FROM ${episodes} ${q('e')} WHERE ${ofSeries} AND ${track(started)})`;
        return `(EXISTS (SELECT 1 FROM ${episodes} ${q('e')} WHERE ${ofSeries}) AND NOT ${unwatchedEpisode})`;
    }

    const spec = SPECS[kind]();
    const track = spec.track!;
    const exists = (condition: string): string => `EXISTS (SELECT 1 FROM ${q(track.table)} ${q('t')} WHERE ${q('t')}.${q(track.key)} = ${q(spec.alias)}.${q('id')} AND ${q('t')}.${q('userId')} = ${user} AND ${condition})`;

    if (state === 'played') return exists(watched);
    if (state === 'resumable') return exists(started);
    return `NOT ${exists(watched)}`;
}

/** When the user last watched this item: for a series, any of its episodes. */
function lastPlayedSql(sequelize: Sequelize, kind: RowKind, userId: number | null): string {
    const q = quoter(sequelize);

    if (!userId) return 'NULL';

    if (kind === 'series') {
        return `(SELECT MAX(${q('t')}.${q('updatedAt')}) FROM ${q(TrackEpisode.getTableName() as string)} ${q('t')}
            JOIN ${q(Episode.getTableName() as string)} ${q('e')} ON ${q('e')}.${q('id')} = ${q('t')}.${q('episodeId')}
            WHERE ${q('e')}.${q('SeriesId')} = ${q('Series')}.${q('id')} AND ${q('t')}.${q('userId')} = ${Number(userId)})`;
    }

    const spec = SPECS[kind]();
    const track = spec.track!;

    return `(SELECT MAX(${q('t')}.${q('updatedAt')}) FROM ${q(track.table)} ${q('t')} WHERE ${q('t')}.${q(track.key)} = ${q(spec.alias)}.${q('id')} AND ${q('t')}.${q('userId')} = ${Number(userId)})`;
}

/** The newest episode a series has, which Jellyfin sorts "recently updated" shows by. */
function lastEpisodeAddedSql(sequelize: Sequelize): string {
    const q = quoter(sequelize);

    return `(SELECT MAX(${q('e')}.${q('createdAt')}) FROM ${q(Episode.getTableName() as string)} ${q('e')} WHERE ${q('e')}.${q('SeriesId')} = ${q('Series')}.${q('id')})`;
}

/** SQL for "one of these people is credited on this item"; a series counts its episodes' guests. */
function personCondition(sequelize: Sequelize, kind: RowKind, personIds: number[]): string {
    const q = quoter(sequelize);
    const people = personIds.map(Number).join(', ');
    const credited = (table: string, key: string): string => `SELECT ${q(key)} FROM ${q(table)} WHERE ${q('personId')} IN (${people})`;
    const self = `${q(SPECS[kind]().alias)}.${q('id')}`;

    if (kind === 'movie') return `${self} IN (${credited(MovieCredit.getTableName() as string, 'movieId')})`;
    if (kind === 'episode') return `${self} IN (${credited(EpisodeCredit.getTableName() as string, 'episodeId')})`;

    return `(${self} IN (${credited(SeriesCredit.getTableName() as string, 'seriesId')})
        OR ${self} IN (SELECT ${q('e')}.${q('SeriesId')} FROM ${q(Episode.getTableName() as string)} ${q('e')}
            WHERE ${q('e')}.${q('id')} IN (${credited(EpisodeCredit.getTableName() as string, 'episodeId')})))`;
}

function whereFor(sequelize: Sequelize, kind: RowKind, query: ItemQuery): WhereOptions | null {
    const spec = SPECS[kind]();
    const q = quoter(sequelize);
    const conditions: any[] = [];

    const ids = query.ids?.get(kind);

    if (ids) conditions.push({ id: { [Op.in]: ids } });

    if (query.searchTerm) conditions.push(containsText(spec.name, query.searchTerm));

    if (kind === 'episode') {
        if (query.seriesId !== null) conditions.push({ SeriesId: query.seriesId });
        if (query.season !== null) conditions.push({ airedSeason: String(query.season) });
    } else if (query.seriesId !== null && kind === 'series') {
        conditions.push({ id: query.seriesId });
    }

    if (query.boxSetId !== null) {
        if (kind !== 'movie') return null;
        conditions.push(literal(`${q(spec.alias)}.${q('id')} IN (SELECT ${q('MovieId')} FROM ${q('MovieSetAllocations')} WHERE ${q('MovieSetId')} = ${Number(query.boxSetId)})`));
    }

    if (query.personIds.length > 0) conditions.push(literal(personCondition(sequelize, kind, query.personIds)));

    if (query.years.length > 0) {
        conditions.push(literal(`SUBSTR(${q(spec.alias)}.${q(spec.date)}, 1, 4) IN (${query.years.map(year => sequelize.escape(String(year))).join(', ')})`));
    }

    if (query.genres.length > 0) {
        // A kind without genres has none of the asked-for ones
        if (!spec.genres) return null;
        conditions.push(literal(`(${query.genres.map(genre => genreCondition(sequelize, `${q(spec.alias)}.${q(spec.genres!)}`, genre)).join(' OR ')})`));
    }

    const played = query.isPlayed ?? (query.filters.has('isplayed') ? true : query.filters.has('isunplayed') ? false : null);

    if (played !== null || query.filters.has('isresumable')) {
        // Watch state is per user; without one, nothing has been watched
        if (!query.userId) {
            if (played === true || query.filters.has('isresumable')) return null;
        } else {
            if (played !== null) conditions.push(literal(watchCondition(sequelize, kind, query.userId, played ? 'played' : 'unplayed')));
            if (query.filters.has('isresumable')) conditions.push(literal(watchCondition(sequelize, kind, query.userId, 'resumable')));
        }
    }

    return conditions.length > 0 ? { [Op.and]: conditions } : {};
}

function orderFor(sequelize: Sequelize, kind: RowKind, query: ItemQuery): Order {
    const spec = SPECS[kind]();
    const q = quoter(sequelize);
    const direction = query.descending ? 'DESC' : 'ASC';
    const order: any[] = [];

    for (const key of query.sortBy) {
        switch (key) {
            case 'sortname':
            case 'name':
                order.push([spec.name, direction]);
                break;
            case 'premieredate':
            case 'productionyear':
                order.push([spec.date, direction]);
                break;
            case 'datecreated':
                order.push(['createdAt', direction]);
                break;
            case 'datelastcontentadded':
                order.push(kind === 'series' ? [literal(lastEpisodeAddedSql(sequelize)), direction] : ['createdAt', direction]);
                break;
            case 'communityrating':
            case 'criticrating':
                order.push(['siteRating', direction]);
                break;
            case 'runtime':
                order.push(['runtime', direction]);
                break;
            case 'dateplayed':
                order.push([literal(lastPlayedSql(sequelize, kind, query.userId)), direction]);
                break;
            case 'parentindexnumber':
                if (kind === 'episode') order.push([castNumber(sequelize, `${q(spec.alias)}.${q('airedSeason')}`), direction]);
                break;
            case 'indexnumber':
                if (kind === 'episode') order.push([castNumber(sequelize, `${q(spec.alias)}.${q('airedEpisodeNumber')}`), direction]);
                break;
            case 'random':
                order.push(fn(sequelize.getDialect() === 'sqlite' ? 'RANDOM' : 'RAND'));
                break;
        }
    }

    if (order.length === 0) {
        if (kind === 'episode') {
            order.push([castNumber(sequelize, `${q(spec.alias)}.${q('airedSeason')}`), 'ASC']);
            order.push([castNumber(sequelize, `${q(spec.alias)}.${q('airedEpisodeNumber')}`), 'ASC']);
        } else {
            order.push([spec.name, direction]);
        }
    }

    order.push(['id', 'ASC']);

    return order;
}

/** The associations an item needs to be described: its files, its series, and this user's progress. */
export function itemIncludes(kind: 'movie' | 'episode' | 'series', userId: number | null): Includeable[] {
    if (kind === 'series') return [];

    const include: Includeable[] = [{ model: File, include: [{ model: Stream }] }];

    if (kind === 'episode') include.unshift({ model: Series });

    if (userId) {
        include.push({
            model: kind === 'movie' ? TrackMovie : TrackEpisode,
            required: false,
            where: { userId }
        });
    }

    return include;
}

/** A season of a series, as the pseudo-item Jellyfin clients navigate through. */
export function seasonItem(series: Series, season: number): MediaItem {
    return {
        id: series.id * 1000 + season,
        seasonName: season === 0 ? 'Specials' : `Season ${season}`,
        seriesName: series.seriesName,
        SeriesId: series.id,
        indexNumber: season
    };
}

/** The season numbers a series has episodes in, in order. */
export async function seasonsOf(seriesId: number): Promise<number[]> {
    const rows = await Episode.findAll({
        where: { SeriesId: seriesId },
        attributes: ['airedSeason'],
        group: ['airedSeason'],
        raw: true
    });

    return [...new Set(rows.map(row => parseInt(String(row.airedSeason), 10)).filter(Number.isFinite))].sort((a, b) => a - b);
}

type Fetched = { kind: ItemKind; row: any; item: Record<string, unknown> };

async function fetchSeasons(query: ItemQuery, embyEmulation: EmbyEmulation, limit: number, offset: number): Promise<{ total: number; rows: Fetched[] }> {
    if (query.seriesId === null) return { total: 0, rows: [] };

    const series = await Series.findByPk(query.seriesId);

    if (!series) return { total: 0, rows: [] };

    let seasons = await seasonsOf(series.id);

    if (query.season !== null) seasons = seasons.filter(season => season === query.season);

    const ids = query.ids?.get('season');

    if (ids) seasons = seasons.filter(season => ids.includes(series.id * 1000 + season));
    if (query.descending) seasons.reverse();

    return {
        total: seasons.length,
        rows: seasons.slice(offset, offset + limit).map(season => {
            const row = seasonItem(series, season);

            return {
 kind: 'season', row, item: formatMediaItem(row, 'season', embyEmulation) 
};
        })
    };
}

async function fetchBoxSets(query: ItemQuery, embyEmulation: EmbyEmulation, limit: number, offset: number): Promise<{ total: number; rows: Fetched[] }> {
    // Sets are not credited, dated or given genres; asking for any of those finds none
    if (query.personIds.length > 0 || query.genres.length > 0 || query.years.length > 0 || query.seriesId !== null) return { total: 0, rows: [] };
    if (query.isPlayed !== null || query.filters.has('isplayed') || query.filters.has('isunplayed') || query.filters.has('isresumable')) return { total: 0, rows: [] };

    const { total, rows, items } = await listBoxSets({
        userId: query.userId,
        searchTerm: query.searchTerm,
        ids: query.ids?.get('boxset') ?? null,
        descending: query.descending,
        byDate: query.sortBy[0] === 'datecreated',
        limit,
        offset
    }, embyEmulation);

    return {
 total,
rows: rows.map((row, index) => ({
 kind: 'boxset', row, item: items[index] 
})) 
};
}

async function fetchKind(kind: ItemKind, query: ItemQuery, embyEmulation: EmbyEmulation, limit: number, offset: number): Promise<{ total: number; rows: Fetched[] }> {
    if (kind === 'season') return fetchSeasons(query, embyEmulation, limit, offset);
    if (kind === 'boxset') return fetchBoxSets(query, embyEmulation, limit, offset);

    const spec = SPECS[kind]();
    const sequelize = spec.model.sequelize!;
    const where = whereFor(sequelize, kind, query);

    if (where === null) return { total: 0, rows: [] };

    const model = spec.model as typeof Movie;
    const total = await model.count({ where });

    if (limit === 0 || offset >= total) return { total, rows: [] };

    const rows = await model.findAll({
        where,
        include: itemIncludes(kind, query.userId),
        order: orderFor(sequelize, kind, query),
        limit,
        offset
    });

    return {
        total,
        rows: rows.map(row => ({
 kind, row, item: formatMediaItem(row as unknown as MediaItem, kind, embyEmulation) 
}))
    };
}

// Values to merge-sort several kinds on, matching what each kind's SQL ordered by.
const sortValue = (entry: Fetched, key: string): string | number => {
    const row = entry.row;
    const date = (value: unknown): number => (value ? new Date(value as string).getTime() || 0 : 0);

    switch (key) {
        case 'premieredate':
        case 'productionyear':
            return date(row.releaseDate ?? row.firstAired);
        case 'datecreated':
        case 'datelastcontentadded':
            return date(row.createdAt);
        case 'communityrating':
        case 'criticrating':
            return Number(row.siteRating ?? 0);
        case 'runtime':
            return Number(row.runtime ?? 0);
        case 'dateplayed':
            return date((row.TrackMovies ?? row.TrackEpisodes)?.[0]?.updatedAt);
        default:
            return typeof entry.item.Name === 'string' ? entry.item.Name.toLowerCase() : '';
    }
};

function mergeOrder(entries: Fetched[], query: ItemQuery): Fetched[] {
    if (query.sortBy.includes('random')) {
        for (let i = entries.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));

            [entries[i], entries[j]] = [entries[j], entries[i]];
        }
        return entries;
    }

    const keys = query.sortBy.length > 0 ? query.sortBy : ['sortname'];
    const sign = query.descending ? -1 : 1;

    return entries.sort((a, b) => {
        for (const key of keys) {
            const left = sortValue(a, key);
            const right = sortValue(b, key);

            if (left < right) return -sign;
            if (left > right) return sign;
        }
        return 0;
    });
}

/**
 * Run a query. One kind pages in the database; several kinds are each fetched up to the end of the
 * page, merged in order, and cut to the page once.
 */
export async function runItemQuery(query: ItemQuery, embyEmulation: EmbyEmulation): Promise<ItemsResult> {
    if (query.kinds.length === 0) return empty(query.startIndex);

    if (query.genreIds.length > 0) {
        const names = await genreNames(query.genreIds);

        if (names.length === 0) return empty(query.startIndex);
        query.genres = [...query.genres, ...names];
    }

    // A set this user may not see lists nothing, rather than its movies
    if (query.boxSetId !== null && !await visibleSet(query.boxSetId, query.userId)) return empty(query.startIndex);

    if (query.kinds.length === 1) {
        const { total, rows } = await fetchKind(query.kinds[0], query, embyEmulation, query.limit, query.startIndex);

        return {
            Items: await decorateItems(rows.map(row => row.item), query.userId),
            TotalRecordCount: total,
            StartIndex: query.startIndex
        };
    }

    const results = await Promise.all(query.kinds.map(kind => fetchKind(kind, query, embyEmulation, query.startIndex + query.limit, 0)));
    const merged = mergeOrder(results.flatMap(result => result.rows), query);

    return {
        Items: await decorateItems(merged.slice(query.startIndex, query.startIndex + query.limit).map(row => row.item), query.userId),
        TotalRecordCount: results.reduce((sum, result) => sum + result.total, 0),
        StartIndex: query.startIndex
    };
}

/** GET /Items and GET /Users/{id}/Items. */
export async function queryItems(req: EmbyRequest, embyEmulation: EmbyEmulation): Promise<ItemsResult> {
    const query = readItemQuery(req);

    if (!query) return empty();

    return runItemQuery(query, embyEmulation);
}
