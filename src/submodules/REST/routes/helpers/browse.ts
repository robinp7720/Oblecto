import { filterKey, type LibraryFilters } from '../../../../lib/library/types.js';

const ALLOWED_ORDERS = new Set(['asc', 'desc']);
const ALLOWED_WATCHED = new Set(['all', 'watched', 'unwatched', 'inprogress']);
const ALLOWED_CREDIT_ROLES = new Set(['any', 'cast', 'director', 'writer', 'creator']);

export interface BrowseParams extends LibraryFilters {
    mode: 'legacy' | 'browse';
    order: 'asc' | 'desc';
    count: number;
    page: number;
    cursor: string | null;
    filterHash: string;
}

interface CursorPayload {
    sort: string;
    order: 'asc' | 'desc';
    sortValue: unknown;
    id: number;
    filterHash: string;
}

function asString(value: unknown): string | null {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
}

function asInteger(value: unknown, fallback: number): number {
    if (typeof value !== 'string' && typeof value !== 'number') return fallback;

    const parsed = parseInt(String(value), 10);

    return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeGenres(rawGenre: unknown): string[] {
    if (rawGenre === undefined || rawGenre === null) return [];

    const chunks = Array.isArray(rawGenre) ? rawGenre : [rawGenre];
    const output = new Set<string>();

    for (const chunk of chunks) {
        if (typeof chunk !== 'string') continue;

        for (const part of chunk.split(',')) {
            const normalized = part.trim();

            if (normalized.length > 0) {
                output.add(normalized);
            }
        }
    }

    return Array.from(output);
}

function clampCount(value: number): number {
    if (!Number.isInteger(value)) return 20;
    if (value < 1) return 1;
    if (value > 100) return 100;

    return value;
}

export function parseBrowseParams(rawParams: Record<string, unknown>): BrowseParams {
    const mode: 'legacy' | 'browse' = rawParams.mode === 'browse' ? 'browse' : 'legacy';
    if (mode === 'browse') {
        for (const field of ['count', 'page', 'yearFrom', 'yearTo', 'personId']) {
            const value = rawParams[field];
            if (value === undefined || value === null) continue;
            if (!((typeof value === 'number' || (typeof value === 'string' && /^-?\d+$/.test(value.trim()))) && Number.isSafeInteger(Number(value))))
                throw new Error(`${field} must be a whole number`);
        }
        for (const field of ['q', 'libraryPath', 'cursor', 'order', 'watched', 'creditRole']) {
            if (rawParams[field] != null && typeof rawParams[field] !== 'string') throw new Error(`${field} must be a string`);
        }
        if (rawParams.genre != null && !(typeof rawParams.genre === 'string' || (Array.isArray(rawParams.genre) && rawParams.genre.every(value => typeof value === 'string'))))
            throw new Error('genre must contain strings');
    }
    const rawOrder = (asString(rawParams.order) || 'asc').toLowerCase();

    if (!ALLOWED_ORDERS.has(rawOrder)) {
        throw new Error('Sorting order is invalid');
    }

    const order = rawOrder as 'asc' | 'desc';
    const count = clampCount(asInteger(rawParams.count, 20));
    const page = Math.max(0, asInteger(rawParams.page, 0));
    const cursor = asString(rawParams.cursor);
    const q = asString(rawParams.q);
    const genres = normalizeGenres(rawParams.genre);

    const yearFrom = rawParams.yearFrom === undefined || rawParams.yearFrom === null
        ? null
        : asInteger(rawParams.yearFrom, Number.NaN);

    const yearTo = rawParams.yearTo === undefined || rawParams.yearTo === null
        ? null
        : asInteger(rawParams.yearTo, Number.NaN);

    if (yearFrom !== null && (!Number.isInteger(yearFrom) || yearFrom < 1 || yearFrom > 9999)) {
        throw new Error('yearFrom is invalid');
    }

    if (yearTo !== null && (!Number.isInteger(yearTo) || yearTo < 1 || yearTo > 9999)) {
        throw new Error('yearTo is invalid');
    }

    if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) {
        throw new Error('yearFrom must be smaller than or equal to yearTo');
    }

    const rawWatched = (asString(rawParams.watched) || 'all').toLowerCase();

    if (!ALLOWED_WATCHED.has(rawWatched)) {
        throw new Error('watched filter is invalid');
    }

    const watched = rawWatched as 'all' | 'watched' | 'unwatched' | 'inprogress';
    const rawList = rawParams.list ?? 'all';
    if (!['all', 'favourites', 'watchlist'].includes(rawList as string)) throw new Error('list filter is invalid');
    const list = rawList as BrowseParams['list'];
    const libraryPath = asString(rawParams.libraryPath);
    const rawPersonId = asString(typeof rawParams.personId === 'number' ? String(rawParams.personId) : rawParams.personId);
    const personId = rawPersonId === null ? null : asInteger(rawPersonId, Number.NaN);
    if (personId !== null && (!Number.isInteger(personId) || personId < 1)) throw new Error('personId is invalid');
    const rawCreditRole = (asString(rawParams.creditRole) || 'any').toLowerCase();
    if (!ALLOWED_CREDIT_ROLES.has(rawCreditRole)) throw new Error('creditRole is invalid');
    const creditRole = rawCreditRole as BrowseParams['creditRole'];

    const filterHash = filterKey({
        q,
        genres: [...genres].sort((a, b) => a.localeCompare(b)),
        yearFrom,
        yearTo,
        watched,
        list,
        libraryPath,
        personId,
        creditRole
    });

    return {
        mode,
        order,
        count,
        page,
        cursor,
        q,
        genres,
        yearFrom,
        yearTo,
        watched,
        list,
        libraryPath,
        personId,
        creditRole,
        filterHash
    };
}

export function encodeCursor(sort: string, order: 'asc' | 'desc', sortValue: unknown, id: number, filterHash: string): string {
    const payload: CursorPayload = {
        sort,
        order,
        sortValue,
        id,
        filterHash
    };

    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decodeCursor(cursor: string, expectedSort: string, expectedOrder: 'asc' | 'desc', expectedFilterHash: string): CursorPayload {
    let decoded: unknown;
    if (cursor.length > 8192) throw new Error('cursor is invalid');
    try { decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')); }
    catch { throw new Error('cursor is invalid'); }
    if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('cursor is invalid');
    const payload = decoded as Record<string, unknown>;
    if (payload.sort !== expectedSort || payload.order !== expectedOrder || payload.filterHash !== expectedFilterHash)
        throw new Error('cursor does not match the current query');
    if (typeof payload.id !== 'number' || !Number.isSafeInteger(payload.id) || payload.id < 1 ||
        !(payload.sortValue === null || typeof payload.sortValue === 'string' || (typeof payload.sortValue === 'number' && Number.isFinite(payload.sortValue))))
        throw new Error('cursor is invalid');
    return {
        sort: expectedSort,
order: expectedOrder,
filterHash: expectedFilterHash,
        id: payload.id,
sortValue: payload.sortValue
    };
}
