// The Jellyfin items Oblecto has no row type of its own for: collections (BoxSets, from movie sets),
// people, and genres. Plus the lists built around an item: similar titles and its ancestors.
import { Op, QueryTypes, literal, type Sequelize, type WhereOptions } from 'sequelize';
import { Movie } from '../../../models/movie.js';
import { Series } from '../../../models/series.js';
import { Episode } from '../../../models/episode.js';
import { MovieSet } from '../../../models/movieSet.js';
import { Person } from '../../../models/person.js';
import { TrackMovie } from '../../../models/trackMovie.js';
import { genresFrom } from '../../common/genres.js';
import { containsText } from '../../common/textSearch.js';
import { enrichPerson } from '../../people/index.js';
import { favouriteIdsSql } from '../../users/favourites.js';
import { WATCHED_PROGRESS } from '../../playback/progress.js';
import { relatedTitles } from '../../../submodules/REST/routes/helpers/related.js';
import { formatId, formatMediaItem, genreId, parseId, type MediaItem } from '../helpers.js';
import { libraryView } from '../views.js';
import { decorateItems } from './itemDetails.js';
import { itemIncludes, seasonItem } from './itemQuery.js';

import type EmbyEmulation from '../index.js';

type Dto = Record<string, unknown>;

const quoter = (sequelize: Sequelize): (name: string) => string => {
    const generator = sequelize.getQueryInterface().queryGenerator as { quoteIdentifier(name: string): string };

    return (name: string) => generator.quoteIdentifier(name);
};

const userData = (id: string): Dto => ({
    PlaybackPositionTicks: 0,
    PlayCount: 0,
    IsFavorite: false,
    Played: false,
    Key: id,
    ItemId: id
});

// Collections

/**
 * The movie sets a user may see: public ones, and private ones shared with them. Only the SQL for
 * the condition, so it can join any query on MovieSets.
 */
export function visibleSets(userId: number | null): WhereOptions {
    const sequelize = MovieSet.sequelize!;
    const q = quoter(sequelize);
    const shared = userId && sequelize.models.MovieSetUsers
        ? [{ id: { [Op.in]: literal(`(SELECT ${q('MovieSetId')} FROM ${q('MovieSetUsers')} WHERE ${q('UserId')} = ${Number(userId)})`) } }]
        : [];

    return { [Op.or]: [{ public: true }, ...shared] };
}

/** One movie set, if this user may see it. */
export async function visibleSet(id: number, userId: number | null): Promise<MovieSet | null> {
    if (!MovieSet.sequelize || !Number.isFinite(id)) return null;

    return MovieSet.findOne({ where: { [Op.and]: [{ id }, visibleSets(userId)] } });
}

type SetCounts = Map<number, { total: number; watched: number; firstMovieId: number | null }>;

/** How many movies each set holds and this user has watched, for a page of sets in one query. */
async function setCounts(setIds: number[], userId: number | null): Promise<SetCounts> {
    const counts: SetCounts = new Map();
    const sequelize = MovieSet.sequelize;

    if (!sequelize || setIds.length === 0) return counts;

    const q = quoter(sequelize);
    const tracks = q(TrackMovie.getTableName() as string);
    const watched = userId
        ? `SUM(CASE WHEN EXISTS (SELECT 1 FROM ${tracks} ${q('t')} WHERE ${q('t')}.${q('movieId')} = ${q('a')}.${q('MovieId')}
            AND ${q('t')}.${q('userId')} = :userId AND ${q('t')}.${q('progress')} >= :watched) THEN 1 ELSE 0 END)`
        : '0';
    const rows = await sequelize.query<{ setId: number; total: number; watched: number; firstMovieId: number }>(
        `SELECT ${q('a')}.${q('MovieSetId')} AS ${q('setId')}, COUNT(*) AS ${q('total')}, ${watched} AS ${q('watched')},
            MIN(${q('a')}.${q('MovieId')}) AS ${q('firstMovieId')}
        FROM ${q('MovieSetAllocations')} ${q('a')} WHERE ${q('a')}.${q('MovieSetId')} IN (:setIds)
        GROUP BY ${q('a')}.${q('MovieSetId')}`,
        {
 replacements: {
 setIds, userId, watched: WATCHED_PROGRESS 
},
type: QueryTypes.SELECT 
}
    );

    for (const row of rows) {
        counts.set(Number(row.setId), {
 total: Number(row.total), watched: Number(row.watched), firstMovieId: Number(row.firstMovieId) || null 
});
    }

    return counts;
}

/** A movie set as a Jellyfin BoxSet. */
export function formatBoxSet(set: MovieSet, embyEmulation: EmbyEmulation, counts?: { total: number; watched: number }): Dto {
    const id = formatId(set.id, 'boxset');
    const name = set.setName ?? '';
    const total = counts?.total ?? 0;
    const watched = counts?.watched ?? 0;

    return {
        Name: name,
        SortName: name.toLowerCase(),
        ServerId: embyEmulation.serverId,
        Id: id,
        Etag: id,
        DateCreated: set.createdAt ? new Date(set.createdAt).toISOString() : undefined,
        Type: 'BoxSet',
        IsFolder: true,
        ParentId: 'collections',
        CollectionType: 'movies',
        MediaType: 'Unknown',
        LocationType: 'FileSystem',
        Overview: set.overview ?? undefined,
        ProviderIds: set.tmdbid ? { Tmdb: String(set.tmdbid) } : {},
        ChildCount: total,
        RecursiveItemCount: total,
        Genres: [],
        Tags: [],
        People: [],
        Studios: [],
        PrimaryImageAspectRatio: 0.6666666666666666,
        // A set's artwork is its first movie's, so an empty set has none
        ImageTags: total > 0 ? { Primary: 'primary' } : {},
        BackdropImageTags: total > 0 ? ['backdrop'] : [],
        UserData: {
            ...userData(id),
            UnplayedItemCount: total - watched,
            Played: total > 0 && watched === total,
            PlayedPercentage: total > 0 ? watched / total * 100 : 0
        }
    };
}

export type BoxSetQuery = {
    userId: number | null;
    searchTerm: string;
    ids: number[] | null;
    favourite: boolean | null;
    descending: boolean;
    byDate: boolean;
    limit: number;
    offset: number;
};

type BoxSetPage = { total: number; items: Dto[]; rows: MovieSet[] };

const NO_SETS: BoxSetPage = {
    total: 0,
    items: [],
    rows: []
};

/** A page of the movie sets this user may see. */
export async function listBoxSets(options: BoxSetQuery, embyEmulation: EmbyEmulation): Promise<BoxSetPage> {
    if (!MovieSet.sequelize) return NO_SETS;

    const conditions: WhereOptions[] = [visibleSets(options.userId)];

    if (options.ids) conditions.push({ id: { [Op.in]: options.ids } });
    if (options.searchTerm) conditions.push(containsText('setName', options.searchTerm));
    if (options.favourite !== null) {
        if (!options.userId) return options.favourite ? NO_SETS : listBoxSets({ ...options, favourite: null }, embyEmulation);
        conditions.push({ id: { [options.favourite ? Op.in : Op.notIn]: literal(favouriteIdsSql(options.userId, 'boxset')) } });
    }

    const where = { [Op.and]: conditions };
    const total = await MovieSet.count({ where });
    const rows = total > options.offset && options.limit > 0
        ? await MovieSet.findAll({
            where,
            order: [[options.byDate ? 'createdAt' : 'setName', options.descending ? 'DESC' : 'ASC'], ['id', 'ASC']],
            limit: options.limit,
            offset: options.offset
        })
        : [];
    const counts = await setCounts(rows.map(row => row.id), options.userId);
    const items = await decorateItems(rows.map(row => formatBoxSet(row, embyEmulation, counts.get(row.id))), options.userId);

    return {
        total,
        rows,
        items
    };
}

/** The movie a set's artwork comes from: its first one. */
export async function boxSetArtworkMovie(set: MovieSet): Promise<Movie | null> {
    const counts = await setCounts([set.id], null);
    const movieId = counts.get(set.id)?.firstMovieId;

    return movieId ? Movie.findByPk(movieId) : null;
}

// People

/** A person as a Jellyfin Person item. */
export function formatPerson(person: Person, embyEmulation: EmbyEmulation): Dto {
    const id = formatId(person.id, 'person');

    return {
        Name: person.name,
        SortName: person.name.toLowerCase(),
        ServerId: embyEmulation.serverId,
        Id: id,
        Etag: id,
        Type: 'Person',
        IsFolder: false,
        MediaType: 'Unknown',
        LocationType: 'FileSystem',
        Overview: person.biography ?? undefined,
        PremiereDate: person.birthday ? new Date(person.birthday).toISOString() : undefined,
        EndDate: person.deathday ? new Date(person.deathday).toISOString() : undefined,
        ProductionLocations: person.placeOfBirth ? [person.placeOfBirth] : [],
        ProviderIds: { Tmdb: String(person.tmdbid) },
        ExternalUrls: [{ Name: 'TheMovieDb', Url: `https://www.themoviedb.org/person/${person.tmdbid}` }],
        PrimaryImageAspectRatio: 0.6666666666666666,
        ImageTags: person.profilePath ? { Primary: 'primary' } : {},
        BackdropImageTags: [],
        UserData: userData(id)
    };
}

// Genres

/** Every genre in the library's movies, series or both, each once, in name order. */
export async function allGenres(kinds: Array<'movie' | 'series'>): Promise<string[]> {
    const byKey = new Map<string, string>();
    const sources = [
        {
 kind: 'movie', model: Movie, column: 'genres' 
},
        {
 kind: 'series', model: Series, column: 'genre' 
}
    ] as const;

    for (const source of sources) {
        if (!kinds.includes(source.kind) || !source.model.sequelize) continue;

        const rows = await (source.model as typeof Movie).findAll({
            attributes: [[literal(`DISTINCT ${quoter(source.model.sequelize)(source.column)}`), 'value']],
            raw: true
        }) as unknown as Array<{ value: string | null }>;

        for (const row of rows) {
            for (const genre of genresFrom(row.value)) {
                if (!byKey.has(genre.toLowerCase())) byKey.set(genre.toLowerCase(), genre);
            }
        }
    }

    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/** The genre names a list of genre ids stands for. */
export async function genreNames(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];

    const wanted = new Set(ids.map(id => id.replace(/-/g, '').toLowerCase()));

    return (await allGenres(['movie', 'series'])).filter(genre => wanted.has(genreId(genre)));
}

/** A genre as a Jellyfin Genre item. */
export function formatGenre(name: string, embyEmulation: EmbyEmulation): Dto {
    const id = genreId(name);

    return {
        Name: name,
        SortName: name.toLowerCase(),
        ServerId: embyEmulation.serverId,
        Id: id,
        Etag: id,
        Type: 'Genre',
        IsFolder: true,
        MediaType: 'Unknown',
        LocationType: 'Virtual',
        ImageTags: {},
        BackdropImageTags: [],
        UserData: userData(id)
    };
}

// Items by id

/** Whether an id names a collection, person or genre, which only resolveLibraryItem describes. */
export const isLibraryItemId = (rawId: string): boolean => ['boxset', 'person', 'genre'].includes(parseId(rawId).type);

/**
 * A collection, person or genre by its Jellyfin id; null for any other id, or one that does not
 * exist or is not this user's to see.
 */
export async function resolveLibraryItem(rawId: string, userId: number | null, embyEmulation: EmbyEmulation): Promise<Dto | null> {
    const { id, type } = parseId(rawId);

    if (type === 'boxset') {
        const set = await visibleSet(id, userId);

        if (!set) return null;

        const [item] = await decorateItems([formatBoxSet(set, embyEmulation, (await setCounts([set.id], userId)).get(set.id))], userId);

        return item;
    }

    if (type === 'person' && Number.isFinite(id) && Person.sequelize) {
        const person = await Person.findByPk(id);

        if (!person) return null;
        if ((embyEmulation.oblecto as { tmdb?: unknown } | undefined)?.tmdb) await enrichPerson(embyEmulation.oblecto, person);

        const [item] = await decorateItems([formatPerson(person, embyEmulation)], userId);

        return item;
    }

    if (type === 'genre') {
        const [name] = await genreNames([rawId]);

        return name ? formatGenre(name, embyEmulation) : null;
    }

    return null;
}

// Around an item

/** Titles like this one, ranked by shared collections, people and genres, for this user. */
export async function similarItems(rawId: string, limit: number, userId: number | null, embyEmulation: EmbyEmulation): Promise<Dto[]> {
    const parsed = parseId(rawId);
    let type: 'movie' | 'series';
    let id: number;

    if (parsed.type === 'movie') {
        type = 'movie';
        id = parsed.id;
    } else if (parsed.type === 'series' || parsed.type === 'season' || parsed.type === 'episode') {
        type = 'series';
        id = parsed.type === 'series' ? parsed.id
            : parsed.type === 'season' ? Math.floor(parsed.id / 1000)
                : (await Episode.findByPk(parsed.id, { attributes: ['SeriesId'] }))?.SeriesId ?? NaN;
    } else {
        return [];
    }

    const model = (type === 'movie' ? Movie : Series) as typeof Movie;
    const source = Number.isFinite(id) ? await model.findByPk(id) : null;

    if (!source || !model.sequelize) return [];

    const related = await relatedTitles(model.sequelize, type, id, type === 'movie' ? (source).genres : (source as unknown as Series).genre);
    const ids = related.map(row => Number(row.id)).slice(0, limit);
    const rows = await model.findAll({ where: { id: ids }, include: itemIncludes(type, userId) });
    const byId = new Map(rows.map(row => [row.id, row]));
    const items = ids
        .map(relatedId => byId.get(relatedId))
        .filter((row): row is Movie => row !== undefined)
        .map(row => formatMediaItem(row as unknown as MediaItem, type, embyEmulation));

    return decorateItems(items, userId);
}

/** The folders an item sits in, nearest first, up to its library view. */
export async function ancestorsOf(rawId: string, embyEmulation: EmbyEmulation): Promise<Dto[]> {
    const { id, type } = parseId(rawId);
    const view = (viewId: 'movies' | 'shows' | 'collections'): Dto => libraryView(viewId, embyEmulation.serverId);

    if (!Number.isFinite(id)) return [];

    if (type === 'movie') return [view('movies')];
    if (type === 'boxset') return [view('collections')];

    let seriesId: number | null = null;
    let season: number | null = null;

    if (type === 'series') seriesId = id;
    else if (type === 'season') {
        seriesId = Math.floor(id / 1000);
        season = id % 1000;
    } else if (type === 'episode') {
        const episode = await Episode.findByPk(id, { attributes: ['SeriesId', 'airedSeason'] });

        if (!episode) return [];
        seriesId = episode.SeriesId;
        season = parseInt(String(episode.airedSeason), 10);
    } else {
        return [];
    }

    const series = await Series.findByPk(seriesId);

    if (!series) return [];

    const ancestors: Dto[] = [];

    if (type === 'episode' && season !== null && Number.isFinite(season)) {
        ancestors.push(formatMediaItem(seasonItem(series, season), 'season', embyEmulation));
    }
    if (type !== 'series') ancestors.push(formatMediaItem(series as unknown as MediaItem, 'series', embyEmulation));
    ancestors.push(view('shows'));

    return ancestors;
}
