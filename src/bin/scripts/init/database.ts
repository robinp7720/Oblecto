import { initDatabase } from '../../../submodules/database.js';

export default async (args: string[]): Promise<void> => {
    const sequelize = initDatabase();

    let options: { alter?: boolean } = {};

    if (args.includes('--alter'))
        options = { alter: true };

    await sequelize.authenticate();
    await sequelize.sync(options);

    await sequelize.close();
};
