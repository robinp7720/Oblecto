import { initDatabase } from '../../submodules/database.js';
import { migrate, pendingMigrations } from '../../submodules/migrations/index.js';

/** oblecto migrate [--status]: bring the database schema up to date, or list what would run. */
export default async (args: string[]): Promise<void> => {
    const sequelize = initDatabase();

    try {
        await sequelize.authenticate();

        if (args.includes('--status')) {
            const pending = await pendingMigrations(sequelize);

            console.log(pending.length ? `Pending migrations:\n  ${pending.join('\n  ')}` : 'The database is up to date');
            return;
        }

        const ran = await migrate(sequelize);

        console.log(ran.length ? `Ran migrations:\n  ${ran.join('\n  ')}` : 'The database is already up to date');
    } finally {
        await sequelize.close();
    }
};
