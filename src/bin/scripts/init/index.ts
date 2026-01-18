type Runner = (args: string[]) => Promise<void> | void;

export default async (args: string[]): Promise<void> => {
    if (args.length === 1) args[1] = 'oblecto';

    switch (args[1]) {
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
    }
};
