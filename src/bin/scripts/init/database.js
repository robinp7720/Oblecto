import databases from '../../submodules/database';

export default async (args) => {
    await databases.sequelize.authenticate()
        .then(() => {
            // Create databases if connection to the database could be established
            return databases.sequelize.sync();
        });

    await databases.sequelize.close();
};
