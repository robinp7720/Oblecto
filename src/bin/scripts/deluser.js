import {User} from '../../models/user';
import {initDatabes} from '../../submodules/database';

export default async (args) => {
    const sequelize = initDatabes();

    if (args.length < 2) {
        console.log('Invalid number of arguments');
        return;
    }

    let user = await User.findOne({
        where: {
            username: args[1]
        }
    });

    await user.destroy();

    console.log('User has been deleted');

    sequelize.close();
};
