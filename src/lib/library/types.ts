import { createHash } from 'node:crypto';
import type { Model } from 'sequelize';
import type { BrowseFacets } from './facets.js';

/** Normalized library filters, independent of HTTP parameter names and response formats. */
export interface LibraryFilters {
    q: string | null;
    genres: string[];
    yearFrom: number | null;
    yearTo: number | null;
    watched: 'all' | 'watched' | 'unwatched' | 'inprogress';
    list: 'all' | 'favourites' | 'watchlist';
    libraryPath: string | null;
    personId: number | null;
    creditRole: 'any' | 'cast' | 'director' | 'writer' | 'creator';
}

export interface LibraryBrowseQuery {
    filters: LibraryFilters;
    sort: string;
    order: 'asc' | 'desc';
    limit: number;
    offset: number;
    after?: { sortValue: unknown; id: number };
}

export interface LibraryPage<M extends Model> {
    items: M[];
    next: { sortValue: unknown; id: number } | null;
    facets: BrowseFacets;
}

export class InvalidBrowseQueryError extends Error {}

/** Stable across ordering/paging changes and shared by facet caching and native cursor binding. */
export function filterKey(filters: LibraryFilters): string {
    return createHash('sha1').update(JSON.stringify({
        q: filters.q,
        genres: [...filters.genres].sort((a, b) => a.localeCompare(b)),
        yearFrom: filters.yearFrom,
        yearTo: filters.yearTo,
        watched: filters.watched,
        list: filters.list,
        libraryPath: filters.libraryPath,
        personId: filters.personId,
        creditRole: filters.creditRole
    })).digest('hex');
}
