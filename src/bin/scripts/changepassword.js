import { User } from '../../models/user';
import { initDatabase } from '../../submodules/database';
import argumentError from './helpers/argumentError';
import bcrypt from 'bcrypt';
import { promises as fs } from 'fs';

export default async (args) => {
    const sequelize = initDatabase();

    let config = JSON.parse(await fs.readFile('/etc/oblecto/config.json'));

    if (args.length < 3) {
        argumentError('changepassword', ['username', 'password']);
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
        let hash = await bcrypt.hash(args[2], config.authentication.saltRounds);

        await user.update({ password: hash });
        console.log(`User ${args[1]}'s password has been changed`);
    }
    sequelize.close();
};
