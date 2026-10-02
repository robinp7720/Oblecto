import type { Sequelize } from 'sequelize';

/** Genres as stored on a movie or series: a JSON array, or comma-separated in older libraries. */
export function genresFrom(raw: unknown): string[] {
    if (typeof raw !== 'string' || !raw.trim()) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    } catch { /* Older libraries store comma-separated genres. */ }
    return raw.split(',').map(value => value.trim()).filter(Boolean);
}

/**
 * SQL that is true when a genre column holds this genre, in either storage format.
 * @param sequelize - The connection, for quoting and the dialect
 * @param column - The column, already quoted and qualified as the query needs it
 * @param genre - The genre's exact name
 */
export function genreCondition(sequelize: Sequelize, column: string, genre: string): string {
    const like = (value: string): string => sequelize.escape(`%${value.replace(/[!%_]/g, '!$&')}%`);
    const csv = `REPLACE(REPLACE(${column}, ', ', ','), ' ,', ',')`;
    const delimited = sequelize.getDialect() === 'sqlite' ? `(',' || ${csv} || ',')` : `CONCAT(',', ${csv}, ',')`;

    return `(${column} LIKE ${like(JSON.stringify(genre))} ESCAPE '!' OR ${delimited} LIKE ${like(',' + genre + ',')} ESCAPE '!')`;
}
