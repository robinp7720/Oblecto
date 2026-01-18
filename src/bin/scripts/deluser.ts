import { User } from '../../models/user.js';
import { initDatabase } from '../../submodules/database.js';
import argumentError from './helpers/argumentError.js';

export default async (args: string[]): Promise<void> => {
    const sequelize = initDatabase();

    if (args.length < 2) {
        argumentError('deluser', ['username']);
        return;
    }

    const user = await User.findOne({ where: { username: args[1] } });

    if (!user) {
        console.log(`User ${args[1]} was not found, please check your spelling`);
        await sequelize.close();
        return;
    }

    await user.destroy();

    console.log('User has been deleted');

    await sequelize.close();
};
