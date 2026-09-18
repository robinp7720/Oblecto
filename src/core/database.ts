import { initDatabase } from '../submodules/database.js';
import { migrate, pendingMigrations } from '../submodules/migrations/index.js';
import logger from '../submodules/logger/index.js';
import type { IConfig } from '../interfaces/config.js';

/**
 * Connect to the database and bring its schema up to date before anything uses it. With
 * database.migrateOnStart off, refuse to start on an out-of-date schema instead.
 */
export async function prepareDatabase(config: IConfig): Promise<void> {
    const sequelize = initDatabase();

    try {
        await sequelize.authenticate();
    } catch (error) {
        throw new Error(`Could not connect to the ${config.database.dialect} database: ${(error as Error).message}`, { cause: error });
    }

    if (config.database.migrateOnStart === false) {
        const pending = await pendingMigrations(sequelize);

        if (pending.length) throw new Error(`The database needs updating. Back it up, then run "oblecto migrate". Pending: ${pending.join(', ')}`);

        return;
    }

    const ran = await migrate(sequelize);

    if (ran.length) logger.info(`Database updated: ${ran.join(', ')}`);
}
