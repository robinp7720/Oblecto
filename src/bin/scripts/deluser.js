import {User} from '../../models/user';
import {initDatabes} from '../../submodules/database';
import argumentError from './helpers/argumentError';

export default async (args) => {
    const sequelize = initDatabes();

    if (args.length < 2) {
        argumentError('deluser', ['username']);
        return;
    }

    let user = await User.findOne({
        where: {
            username: args[1]
        }
    });

    if (user == null){
        console.log('No user found to delete');
        return;
    }

    await user.destroy();

    console.log('User has been deleted');

    sequelize.close();
};
