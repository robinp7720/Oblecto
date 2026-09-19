import type { Sequelize } from 'sequelize';
import config from '../../../config.js';
import { prepareDatabase } from '../../../core/database.js';
import { initDatabase } from '../../../submodules/database.js';

/**
 * The database, connected and migrated, for CLI commands. `oblecto adduser` straight after
 * `oblecto init` meets an empty database, so it has to create the schema just as `start` does.
 */
export async function openDatabase(): Promise<Sequelize> {
    await prepareDatabase(config);

    return initDatabase();
}
