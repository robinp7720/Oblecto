import { createRequire } from 'node:module';
import nodeSqlite from './nodeSqlite.js';

const require = createRequire(import.meta.url);

export type SqliteDriver = {
    // What Sequelize gets as dialectModule
    module: object;
    name: 'sqlite3' | 'node:sqlite';
    // Why the native module was not used, when it was not
    fallbackReason?: string;
};

/**
 * The native sqlite3 module when it is installed and its binary loads, otherwise Node's built-in
 * node:sqlite. sqlite3 runs queries on a background thread, so the server keeps answering during
 * long ones; but its binary comes from an install script that npm 12 skips on `npm install -g`
 * unless the installer allows it (`--allow-scripts=sqlite3`). node:sqlite always works.
 * @param load - Loads sqlite3; replaceable in tests
 */
export function chooseSqliteDriver(load: () => unknown = () => require('sqlite3')): SqliteDriver {
    try {
        const native = load() as { Database?: unknown } | undefined;

        if (typeof native?.Database !== 'function') throw new Error('sqlite3 has no Database class');

        return { module: native as object, name: 'sqlite3' };
    } catch (error) {
        const message = (error as Error).message ?? String(error);

        return {
            module: nodeSqlite,
            name: 'node:sqlite',
            fallbackReason: (error as { code?: string }).code === 'MODULE_NOT_FOUND' && message.includes("'sqlite3'")
                ? 'sqlite3 is not installed'
                : `sqlite3 could not load (${message.split('\n')[0]})`
        };
    }
}
