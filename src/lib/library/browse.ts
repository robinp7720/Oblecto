import { Op, literal, type IncludeOptions, type Model, type ModelStatic, type WhereOptions } from 'sequelize';
import { Movie } from '../../models/movie.js';
import { Series } from '../../models/series.js';
import { Episode } from '../../models/episode.js';
import { File } from '../../models/file.js';
import { TrackMovie } from '../../models/trackMovie.js';
import { MovieCredit } from '../../models/movieCredit.js';
import { SeriesCredit } from '../../models/seriesCredit.js';
import { containsText, startsWithText } from '../common/textSearch.js';
import { genreCondition } from '../common/genres.js';
import { favouriteIdsSql } from '../users/favourites.js';
import { watchlistIdsSql as movieWatchlistIdsSql } from '../users/watchlist.js';
import { watchlistIdsSql as seriesWatchlistIdsSql } from '../users/seriesWatchlist.js';
import { browseFacets } from './facets.js';
import { buildCursorWhere } from './pagination.js';
import { itemWatchCondition, progressWhere } from './watchState.js';
import { InvalidBrowseQueryError, type LibraryBrowseQuery, type LibraryFilters, type LibraryPage } from './types.js';

type Kind = 'movie' | 'series';
const SORTS: Record<Kind, Set<string>> = {
    movie: new Set(['movieName', 'releaseDate', 'createdAt', 'updatedAt', 'popularity', 'runtime']),
    series: new Set(['seriesName', 'firstAired', 'createdAt', 'updatedAt', 'siteRating', 'siteRatingCount', 'popularity'])
};

function validateQuery(kind: Kind, query: LibraryBrowseQuery): void {
    if (!SORTS[kind].has(query.sort)) throw new InvalidBrowseQueryError('Sorting method is invalid');
    if (!['asc', 'desc'].includes(query.order)) throw new InvalidBrowseQueryError('Sorting order is invalid');
    if (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 100)
        throw new InvalidBrowseQueryError('Page size is invalid');
    if (!Number.isSafeInteger(query.offset) || query.offset < 0) throw new InvalidBrowseQueryError('Page offset is invalid');
}

function filtersFor(kind: Kind, filters: LibraryFilters, userId: number): WhereOptions[] {
    const movie = kind === 'movie';
    const model = movie ? Movie : Series;
    const database = model.sequelize!;
    const clauses: WhereOptions[] = [];
    if (filters.list !== 'all') {
        const ids = filters.list === 'favourites'
            ? favouriteIdsSql(userId, kind)
            : (movie ? movieWatchlistIdsSql : seriesWatchlistIdsSql)(userId);
        clauses.push({ id: { [Op.in]: literal(ids) } });
    }
    if (filters.q !== null && filters.q !== '') clauses.push({
        [Op.or]: [
            containsText(movie ? 'movieName' : 'seriesName', filters.q),
            containsText(movie ? 'originalName' : 'alias', filters.q)
        ]
    });
    if (filters.genres.length) {
        const generator = database.getQueryInterface().queryGenerator as { quoteIdentifier(name: string): string };
        const column = `${generator.quoteIdentifier(model.name)}.${generator.quoteIdentifier(movie ? 'genres' : 'genre')}`;
        clauses.push({ [Op.or]: filters.genres.map(genre => literal(genreCondition(database, column, genre))) });
    }
    if (filters.yearFrom !== null || filters.yearTo !== null) {
        const dates: { [Op.gte]?: string; [Op.lte]?: string } = {};
        if (filters.yearFrom !== null) dates[Op.gte] = `${String(filters.yearFrom).padStart(4, '0')}-01-01`;
        if (filters.yearTo !== null) dates[Op.lte] = `${String(filters.yearTo).padStart(4, '0')}-12-31`;
        clauses.push({ [movie ? 'releaseDate' : 'firstAired']: dates });
    }
    return clauses;
}

function creditFilter(filters: LibraryFilters): WhereOptions {
    const conditions: WhereOptions[] = [{ personId: filters.personId }];
    if (filters.creditRole === 'cast') conditions.push({ creditType: 'cast' });
    if (filters.creditRole === 'director') conditions.push({ job: 'Director' });
    if (filters.creditRole === 'writer') conditions.push({ job: { [Op.in]: ['Writer', 'Screenplay', 'Story'] } });
    if (filters.creditRole === 'creator') conditions.push({ job: 'Creator' });
    return { [Op.and]: conditions };
}

async function page<M extends Model>(
    model: ModelStatic<M>, query: LibraryBrowseQuery, userId: number,
    clauses: WhereOptions[], include: IncludeOptions[], genreField: string, dateField: string
): Promise<LibraryPage<M>> {
    // Facets describe the whole filtered library, independently of the page or sort direction.
    const facets = await browseFacets(model, query.filters, userId, {
        include, where: { [Op.and]: clauses }, subQuery: false
    }, genreField, dateField);
    if (query.after) clauses.push(buildCursorWhere(query.sort, query.order, query.after.sortValue, query.after.id));
    const rows = await model.findAll({
        include,
        where: { [Op.and]: clauses },
        order: [[query.sort, query.order], ['id', query.order]],
        limit: query.limit + 1,
        offset: query.after ? undefined : query.offset,
        subQuery: false
    });
    const hasNext = rows.length > query.limit;
    const items = hasNext ? rows.slice(0, query.limit) : rows;
    const last = items.at(-1);
    return {
        items,
        next: hasNext && last ? { sortValue: last.get(query.sort) ?? null, id: Number(last.get('id')) } : null,
        facets
    };
}

export function browseMovies(query: LibraryBrowseQuery, userId: number): Promise<LibraryPage<Movie>> {
    validateQuery('movie', query);
    const filters = query.filters;
    const clauses = filtersFor('movie', filters, userId);
    const track: IncludeOptions = {
        model: TrackMovie, required: false, where: { userId }
    };
    if (filters.watched === 'watched' || filters.watched === 'inprogress') {
        track.required = true;
        track.where = { userId, ...progressWhere(filters.watched === 'watched' ? 'finished' : 'inprogress') };
    } else if (filters.watched === 'unwatched') {
        const unstarted = [{ '$TrackMovies.id$': null }, { '$TrackMovies.progress$': { [Op.lte]: 0 } }];
        clauses.push({ [Op.or]: unstarted });
    }
    const include: IncludeOptions[] = [track];
    if (filters.libraryPath !== null && filters.libraryPath !== '') include.push({
        model: File,
        attributes: [],
        through: { attributes: [] },
        required: true,
        where: startsWithText('path', filters.libraryPath)
    });
    if (filters.personId !== null) include.push({
        model: MovieCredit, as: 'Credits', attributes: [], required: true, where: creditFilter(filters)
    });
    return page(Movie, query, userId, clauses, include, 'genres', 'releaseDate');
}

export function browseSeries(query: LibraryBrowseQuery, userId: number): Promise<LibraryPage<Series>> {
    validateQuery('series', query);
    const filters = query.filters;
    const clauses = filtersFor('series', filters, userId);
    if (filters.watched !== 'all') {
        const state = filters.watched === 'watched' ? 'finished' : filters.watched === 'unwatched' ? 'unstarted' : 'inprogress';
        clauses.push(literal(itemWatchCondition(Series.sequelize!, 'series', userId, state, 'any')));
    }
    const include: IncludeOptions[] = [];
    if (filters.libraryPath !== null && filters.libraryPath !== '') include.push({
        model: Episode,
        attributes: [],
        required: true,
        include: [
            {
                model: File,
                attributes: [],
                through: { attributes: [] },
                required: true,
                where: startsWithText('path', filters.libraryPath)
            }
        ]
    });
    if (filters.personId !== null) include.push({
        model: SeriesCredit, as: 'Credits', attributes: [], required: true, where: creditFilter(filters)
    });
    return page(Series, query, userId, clauses, include, 'genre', 'firstAired');
}
