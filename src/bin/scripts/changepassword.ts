import { User } from '../../models/user.js';
import { initDatabase } from '../../submodules/database.js';
import argumentError from './helpers/argumentError.js';
import bcrypt from 'bcrypt';
import { promises as fs } from 'fs';

type AuthConfig = {
    authentication: {
        saltRounds: number;
    };
};

export default async (args: string[]): Promise<void> => {
    const sequelize = initDatabase();

    const config = JSON.parse(await fs.readFile('/etc/oblecto/config.json', 'utf8')) as AuthConfig;

    if (args.length < 3) {
        argumentError('changepassword', ['username', 'password']);
        return;
    }

    const user = await User.findOne({ where: { username: args[1] } });

    if (user == null){
        console.log(`User ${args[1]} was not found, please check your spelling`);
    } else {
        const hash = await bcrypt.hash(args[2], config.authentication.saltRounds);

        await user.update({ password: hash });
        console.log(`User ${args[1]}'s password has been changed`);
    }
    await sequelize.close();
};
