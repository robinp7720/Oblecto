/**
 * The part of the sqlite3 package's API that Sequelize's SQLite dialect uses, on top of Node's
 * built-in node:sqlite. sqlite3 is a native module that downloads or compiles its binary in an
 * install script, and npm 12 skips dependency install scripts on `npm install -g`, which left
 * global installs unable to open their database. node:sqlite ships with Node, so there is nothing
 * to build, and the database file format is the same.
 *
 * Passed to Sequelize as `dialectModule`. Calls are synchronous underneath; Sequelize runs SQLite
 * with a single connection, so they are already serialised.
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

// sqlite3's open flags, which Sequelize reads from the module
export const OPEN_READONLY = 0x00000001;
export const OPEN_READWRITE = 0x00000002;
export const OPEN_CREATE = 0x00000004;

type Callback<T = unknown> = (this: Statement, error: Error | null, result?: T) => void;
type Parameters = unknown[] | Record<string, unknown> | undefined;

// SQLite's primary result codes, so errors carry the names sqlite3 gave them (SQLITE_CONSTRAINT, ...).
const PRIMARY_CODES = [
    'OK', 'ERROR', 'INTERNAL', 'PERM', 'ABORT', 'BUSY', 'LOCKED', 'NOMEM', 'READONLY', 'INTERRUPT',
    'IOERR', 'CORRUPT', 'NOTFOUND', 'FULL', 'CANTOPEN', 'PROTOCOL', 'EMPTY', 'SCHEMA', 'TOOBIG',
    'CONSTRAINT', 'MISMATCH', 'MISUSE', 'NOLFS', 'AUTH', 'FORMAT', 'RANGE', 'NOTADB'
];

/** Reshape a node:sqlite error the way sqlite3 reported it, which Sequelize's error mapping expects. */
function asSqlite3Error(error: unknown): Error {
    const original = error as Error & { errcode?: number; code?: string; errno?: number };

    if (typeof original.errcode !== 'number') return original;

    const code = `SQLITE_${PRIMARY_CODES[original.errcode & 0xff] ?? 'ERROR'}`;
    const converted = new Error(`${code}: ${original.message}`, { cause: original }) as Error & { code: string; errno: number };

    converted.code = code;
    converted.errno = original.errcode;
    return converted;
}

// sqlite3 bound booleans as 1 and 0, dates as milliseconds, undefined as NULL, and whole numbers as
// integers. node:sqlite binds every number as a float, which a text column would store as "1.0".
function bindable(value: unknown): SQLInputValue {
    if (value === undefined) return null;
    if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.getTime();

    return value as SQLInputValue;
}

function bindings(parameters: Parameters): SQLInputValue[] | [Record<string, SQLInputValue>] {
    if (parameters === undefined) return [];
    if (Array.isArray(parameters)) return parameters.map(bindable);

    return [Object.fromEntries(Object.entries(parameters).map(([name, value]) => [name, bindable(value)]))];
}

/** What sqlite3 passes as `this` to callbacks. Sequelize reads lastID and changes, and checks the class name. */
export class Statement {
    constructor(public sql: string, public lastID = 0, public changes = 0) {}
}

export class Database {
    public filename: string;
    private db?: DatabaseSync;

    constructor(filename: string, mode: number | Callback = OPEN_READWRITE | OPEN_CREATE, callback?: Callback) {
        const done = typeof mode === 'function' ? mode : callback;
        const flags = typeof mode === 'number' ? mode : OPEN_READWRITE | OPEN_CREATE;

        this.filename = filename;

        let failure: Error | null = null;

        try {
            this.db = new DatabaseSync(filename, { readOnly: (flags & OPEN_READWRITE) === 0 });
        } catch (error) {
            failure = asSqlite3Error(error);
        }

        // sqlite3 opens asynchronously and reports through the callback
        process.nextTick(() => done?.call(new Statement(''), failure));
    }

    private database(): DatabaseSync {
        if (!this.db) throw new Error('SQLITE_MISUSE: Database is closed');

        return this.db;
    }

    private execute<T>(sql: string, parameters: Parameters | Callback, callback: Callback<T> | undefined, work: (statement: ReturnType<DatabaseSync['prepare']>, values: ReturnType<typeof bindings>, context: Statement) => T): this {
        const done = typeof parameters === 'function' ? parameters as Callback<T> : callback;
        const values = bindings(typeof parameters === 'function' ? undefined : parameters);
        const context = new Statement(sql);

        let result: T | undefined;
        let failure: Error | null = null;

        try {
            result = work(this.database().prepare(sql), values, context);
        } catch (error) {
            failure = asSqlite3Error(error);
        }

        process.nextTick(() => done?.call(context, failure, result));
        return this;
    }

    run(sql: string, parameters?: Parameters | Callback, callback?: Callback): this {
        return this.execute(sql, parameters, callback, (statement, values, context) => {
            const outcome = statement.run(...values as SQLInputValue[]);

            context.lastID = Number(outcome.lastInsertRowid);
            context.changes = Number(outcome.changes);
            return undefined;
        });
    }

    all(sql: string, parameters?: Parameters | Callback, callback?: Callback): this {
        return this.execute(sql, parameters, callback, (statement, values) => statement.all(...values as SQLInputValue[]).map(row => ({ ...row })));
    }

    get(sql: string, parameters?: Parameters | Callback, callback?: Callback): this {
        return this.execute(sql, parameters, callback, (statement, values) => {
            const row = statement.get(...values as SQLInputValue[]);

            return row === undefined ? undefined : { ...row };
        });
    }

    exec(sql: string, callback?: Callback): this {
        let failure: Error | null = null;

        try {
            this.database().exec(sql);
        } catch (error) {
            failure = asSqlite3Error(error);
        }

        process.nextTick(() => callback?.call(new Statement(sql), failure));
        return this;
    }

    // Calls here already run one after another.
    serialize(callback?: () => void): void {
        callback?.();
    }

    close(callback?: (error: Error | null) => void): void {
        let failure: Error | null = null;

        try {
            this.db?.close();
        } catch (error) {
            failure = asSqlite3Error(error);
        }

        this.db = undefined;
        process.nextTick(() => callback?.(failure));
    }
}

export default {
    Database,
    Statement,
    OPEN_READONLY,
    OPEN_READWRITE,
    OPEN_CREATE
};
