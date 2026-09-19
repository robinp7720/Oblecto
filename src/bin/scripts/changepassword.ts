import bcrypt from 'bcrypt';
import config from '../../config.js';
import { User } from '../../models/user.js';
import { openDatabase } from './helpers/openDatabase.js';
import argumentError from './helpers/argumentError.js';
import { passwordArgument } from './helpers/readPassword.js';

// oblecto changepassword USERNAME [PASSWORD|-]
export default async (args: string[]): Promise<void> => {
    if (args.length < 2) {
        argumentError('changepassword', ['username', '[password, or - or nothing to be asked]']);
        return;
    }

    const sequelize = await openDatabase();

    try {
        const user = await User.findOne({ where: { username: args[1] } });

        if (user == null) {
            console.log(`User ${args[1]} was not found, please check your spelling`);
            return;
        }

        const password = await passwordArgument(args[2]);

        if (!password) {
            console.log('No password given; nothing changed. Use "oblecto removepassword" to remove one.');
            return;
        }

        await user.update({ password: await bcrypt.hash(password, config.authentication.saltRounds) });
        console.log(`${args[1]}'s password has been changed, which signs them out everywhere`);
    } finally {
        await sequelize.close();
    }
};
