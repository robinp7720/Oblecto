import bcrypt from 'bcrypt';
import config from '../../config.js';
import { User } from '../../models/user.js';
import { initDatabase } from '../../submodules/database.js';
import argumentError from './helpers/argumentError.js';
import { passwordArgument } from './helpers/readPassword.js';
import { Group } from '../../models/group.js';
import { DEFAULT_GROUP, seedGroups } from '../../lib/auth/permissions.js';

// oblecto adduser USERNAME PASSWORD|- REALNAME EMAIL [GROUP]
export default async (args: string[]): Promise<void> => {
    if (args.length < 5) {
        argumentError('adduser', ['username', 'password (or - to be asked)', 'realname', 'email']);
        return;
    }

    const sequelize = initDatabase();

    try {
        await seedGroups();

        const groupName = args[5] ?? DEFAULT_GROUP;
        const group = await Group.findOne({ where: { name: groupName } });

        if (group == null) {
            console.log(`Group ${groupName} was not found`);
            return;
        }

        if (await User.findOne({ where: { username: args[1] } })) {
            console.log(`A user called ${args[1]} already exists`);
            return;
        }

        const password = await passwordArgument(args[2]);
        const user = await User.create({
            username: args[1],
            name: args[3],
            email: args[4],
            password: password ? await bcrypt.hash(password, config.authentication.saltRounds) : null,
            avatar: null,
            groupId: group.id
        });

        console.log(`User ${user.username} has been created in ${group.name}`);
    } finally {
        await sequelize.close();
    }
};
