export default async (args) => {
    if (args.length === 1) args[1] = 'oblecto';

    switch (args[1]) {
        case 'oblecto':
            await require('./general').default(args);
            break;
        case 'database':
            await require('./database').default(args);
            break;
    }
};
