import { createHash } from 'crypto';
import { Op } from 'sequelize';

const ALLOWED_ORDERS = new Set(['asc', 'desc']);
const ALLOWED_WATCHED = new Set(['all', 'watched', 'unwatched', 'inprogress']);

export interface BrowseParams {
    mode: 'legacy' | 'browse';
    order: 'asc' | 'desc';
    count: number;
    page: number;
    cursor: string | null;
    q: string | null;
    genres: string[];
    yearFrom: number | null;
    yearTo: number | null;
    watched: 'all' | 'watched' | 'unwatched' | 'inprogress';
    libraryPath: string | null;
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
    const libraryPath = asString(rawParams.libraryPath);

    const filterHash = hashFilters({
        q,
        genres: [...genres].sort((a, b) => a.localeCompare(b)),
        yearFrom,
        yearTo,
        watched,
        libraryPath
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
        libraryPath,
        filterHash
    };
}

function hashFilters(payload: Record<string, unknown>): string {
    return createHash('sha1').update(JSON.stringify(payload)).digest('hex');
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
    let payload: CursorPayload;

    try {
        payload = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as CursorPayload;
    } catch (error) {
        throw new Error('cursor is invalid');
    }

    if (!payload || typeof payload !== 'object') {
        throw new Error('cursor is invalid');
    }

    if (payload.sort !== expectedSort || payload.order !== expectedOrder || payload.filterHash !== expectedFilterHash) {
        throw new Error('cursor does not match the current query');
    }

    if (!Number.isInteger(payload.id)) {
        throw new Error('cursor is invalid');
    }

    return payload;
}

export function buildCursorWhere(sortField: string, order: 'asc' | 'desc', sortValue: unknown, id: number): Record<string, unknown> {
    const sortOp = order === 'asc' ? Op.gt : Op.lt;
    const idOp = order === 'asc' ? Op.gt : Op.lt;

    if (sortValue === null || sortValue === undefined) {
        return {
            [Op.or]: [
                {
                    [sortField]: null,
                    id: {
                        [idOp]: id
                    }
                },
                {
                    [sortField]: {
                        [Op.not]: null
                    }
                }
            ]
        };
    }

    return {
        [Op.or]: [
            {
                [sortField]: {
                    [sortOp]: sortValue
                }
            },
            {
                [sortField]: sortValue,
                id: {
                    [idOp]: id
                }
            }
        ]
    };
}

export function escapeLike(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
}
