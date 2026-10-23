import type { Sequelize } from 'sequelize';
import logger from './logger/index.js';

/** Keep SQLite's planner informed without an unbounded scan on older SQLite releases. */
export async function optimizeDatabase(database: Sequelize, initial = false): Promise<void> {
    if (database.getDialect() !== 'sqlite') return;
    await database.query('PRAGMA analysis_limit = 1000');
    await database.query(initial ? 'PRAGMA optimize = 0x10002' : 'PRAGMA optimize');
}

export class DatabaseOptimizer {
    private timer?: NodeJS.Timeout;
    private pending?: Promise<void>;

    constructor(private readonly database: Sequelize) {
        if (database.getDialect() !== 'sqlite') return;
        this.timer = setInterval(() => {
            if (this.pending) return;
            this.pending = optimizeDatabase(database).catch((error: unknown) => {
                logger.warn('Could not refresh SQLite planner statistics', error);
            }).finally(() => { this.pending = undefined; });
        }, 60 * 60 * 1000);
        this.timer.unref();
    }

    async close(): Promise<void> {
        clearInterval(this.timer);
        await this.pending;
    }
}
