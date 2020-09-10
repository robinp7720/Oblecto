import {initDatabes} from '../../../submodules/database';

export default async (args) => {
    const sequelize = initDatabes();

    await sequelize.authenticate()
        .then(() => {
            // Create databases if connection to the database could be established
            return sequelize.sync();
        });

    await sequelize.close();
};
