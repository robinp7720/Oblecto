import { initDatabase } from '../../../submodules/database';

export default async (args) => {
    const sequelize = initDatabase();

    let options = {};

    if ('--alter' in args)
        options = { alter: true };

    await sequelize.authenticate();
    await sequelize.sync(options);

    await sequelize.close();
};
