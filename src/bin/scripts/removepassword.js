import {User} from '../../models/user';
import {initDatabes} from '../../submodules/database';
import argumentError from './helpers/argumentError';

export default async (args) => {
    const sequelize = initDatabes();

    if (args.length < 2) {
        argumentError('removepassword', ['username']);
        return;
    }

    let user = await User.findOne({
        where: {
            username: args[1]
        }
    });

    if (user == null){
        console.log(`User ${args[1]} was not found, please check your spelling`);
    } else {
        await user.update({password: ''});
        console.log(`User ${args[1]}'s password has been removed`);
    }
    sequelize.close();
};
