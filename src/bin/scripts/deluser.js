import { User } from '../../models/user';
import { initDatabase } from '../../submodules/database';
import argumentError from './helpers/argumentError';

export default async (args) => {
    const sequelize = initDatabase();

    if (args.length < 2) {
        argumentError('deluser', ['username']);
        return;
    }

    let user = await User.findOne({ where: { username: args[1] } });

    await user.destroy();

    console.log('User has been deleted');

    sequelize.close();
};
