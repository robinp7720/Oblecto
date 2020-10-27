import {promises as fs} from 'fs';
import bcrypt from 'bcrypt';
import {User} from '../../models/user';
import {initDatabase} from '../../submodules/database';
import argumentError from './helpers/argumentError';

export default async (args) => {
    const sequelize = initDatabase();

    let config = JSON.parse(await fs.readFile('/etc/oblecto/config.json'));

    if (args.length < 5) {
        argumentError('adduser', ['username', 'password', 'realname', 'email']);
        return;
    }

    let hash = await bcrypt.hash(args[2], config.authentication.saltRounds);


    let [user, inserted] = await User.findOrCreate({
        where: {
            username: args[1]
        },
        defaults: {
            name: args[3],
            email: args[4],
            password: hash
        }
    });

    if (inserted) {
        console.log('User has been created');
    } else {
        console.log('A user that with username already exists!');
    }

    sequelize.close();
};
