import { Op, col, fn, where, type WhereOptions } from 'sequelize';

/**
 * Case-insensitive "column contains text". Unlike a LIKE pattern, % and _ in the text match
 * themselves, and it behaves the same on SQLite (which has no default LIKE escape) and MariaDB.
 * @param column - Column on the queried model
 * @param text - What the user typed
 */
export function containsText(column: string, text: string): WhereOptions {
    return where(fn('INSTR', fn('LOWER', col(column)), text.toLowerCase()), Op.gt, 0);
}

/** "column starts with text", exactly, with no wildcard characters. For library folder filters. */
export function startsWithText(column: string, text: string): WhereOptions {
    return where(fn('SUBSTR', col(column), 1, text.length), text);
}
