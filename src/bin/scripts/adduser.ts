import { promises as fs } from 'fs';
import bcrypt from 'bcrypt';
import { User } from '../../models/user.js';
import { initDatabase } from '../../submodules/database.js';
import argumentError from './helpers/argumentError.js';

type AuthConfig = {
    authentication: {
        saltRounds: number;
    };
};

export default async (args: string[]): Promise<void> => {
    const sequelize = initDatabase();

    const config = JSON.parse(await fs.readFile('/etc/oblecto/config.json', 'utf8')) as AuthConfig;

    if (args.length < 5) {
        argumentError('adduser', ['username', 'password', 'realname', 'email']);
        return;
    }

    const hash = await bcrypt.hash(args[2], config.authentication.saltRounds);

    const [user, inserted] = await User.findOrCreate({
        where: { username: args[1] },
        defaults: {
            name: args[3],
            email: args[4],
            password: hash
        }
    });

    if (inserted) {
        console.log(`User with username ${user.username} has been created`);
    } else {
        console.log('A user that with username already exists!');
    }

    await sequelize.close();
};
