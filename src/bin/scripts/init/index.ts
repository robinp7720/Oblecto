type Runner = (args: string[]) => Promise<void> | void;

export default async (args: string[]): Promise<void> => {
    // `oblecto init [database|assets] [--options]`: without a sub-command, set up the configuration.
    const command = args[1] !== undefined && !args[1].startsWith('--') ? args[1] : 'oblecto';

    switch (command) {
        case 'oblecto': {
            const { default: general } = await import('./general.js');

            await (general as Runner)(args);
            break;
        }
        case 'database': {
            const { default: database } = await import('./database.js');

            await (database as Runner)(args);
            break;
        }
        case 'assets': {
            const { default: assets } = await import('./assets.js');

            await (assets as Runner)(args);
            break;
        }
        default:
            console.log(`Unknown init step "${command}". Use: oblecto init [database|assets] [--config-dir DIR] [--force]`);
            process.exitCode = 1;
    }
};
