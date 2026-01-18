import { User } from '../../models/user.js';
import { initDatabase } from '../../submodules/database.js';
import argumentError from './helpers/argumentError.js';

export default async (args: string[]): Promise<void> => {
    const sequelize = initDatabase();

    if (args.length < 2) {
        argumentError('removepassword', ['username']);
        return;
    }

    const user = await User.findOne({ where: { username: args[1] } });

    if (user == null){
        console.log(`User ${args[1]} was not found, please check your spelling`);
    } else {
        await user.update({ password: '' });
        console.log(`User ${args[1]}'s password has been removed`);
    }
    await sequelize.close();
};
