import type { Movie } from '../../../../models/movie.js';
import type { Series } from '../../../../models/series.js';
import type { LibraryFilters } from '../../../../lib/library/types.js';
import type { BrowseFacets } from '../../../../lib/library/facets.js';
import { browseMovies, browseSeries } from '../../../../lib/library/browse.js';
import { InvalidBrowseQueryError, type LibraryBrowseQuery } from '../../../../lib/library/types.js';
import { decodeCursor, encodeCursor, type BrowseParams } from './browse.js';

interface NativeBrowseResponse {
    items: Movie[] | Series[];
    pageInfo: { hasNextPage: boolean; nextCursor: string | null; count: number };
    appliedFilters: Omit<LibraryFilters, 'genres'> & { genre: string[] };
    facets: BrowseFacets;
}

/** Native API pagination and response formatting stay outside the shared library services. */
export async function browseResponse(kind: 'movie' | 'series', sorting: string, params: BrowseParams, userId: number): Promise<NativeBrowseResponse> {
    let after: LibraryBrowseQuery['after'];
    if (params.cursor !== null && params.cursor !== '') {
        try { after = decodeCursor(params.cursor, sorting, params.order, params.filterHash); }
        catch (error) { throw new InvalidBrowseQueryError(error instanceof Error ? error.message : 'cursor is invalid'); }
    }
    const query: LibraryBrowseQuery = {
        filters: params,
        sort: sorting,
        order: params.order,
        limit: params.count,
        offset: params.count * params.page,
        after
    };
    const result = await (kind === 'movie' ? browseMovies(query, userId) : browseSeries(query, userId));
    return {
        items: result.items,
        pageInfo: {
            hasNextPage: result.next !== null,
            nextCursor: result.next ? encodeCursor(sorting, params.order, result.next.sortValue, result.next.id, params.filterHash) : null,
            count: result.items.length
        },
        appliedFilters: {
            q: params.q,
            genre: params.genres,
            yearFrom: params.yearFrom,
            yearTo: params.yearTo,
            watched: params.watched,
            list: params.list,
            libraryPath: params.libraryPath,
            personId: params.personId,
            creditRole: params.creditRole
        },
        facets: result.facets
    };
}
