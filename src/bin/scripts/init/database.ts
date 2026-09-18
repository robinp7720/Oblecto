import migrate from '../migrate.js';

// Creating a database is running every migration on an empty one.
export default async (args: string[]): Promise<void> => {
    if (args.includes('--alter'))
        console.log('--alter is no longer needed: the database is created and updated by migrations.');

    await migrate(args.filter(arg => arg !== '--alter'));
};
