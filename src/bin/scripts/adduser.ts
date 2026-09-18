import { promises as fs } from 'fs';
import bcrypt from 'bcrypt';
import { User } from '../../models/user.js';
import { initDatabase } from '../../submodules/database.js';
import argumentError from './helpers/argumentError.js';
import { Group } from '../../models/group.js';
import { DEFAULT_GROUP, seedGroups } from '../../lib/auth/permissions.js';

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

    await seedGroups();

    const groupName = args[5] ?? DEFAULT_GROUP;
    const group = await Group.findOne({ where: { name: groupName } });

    if (group == null) {
        console.log(`Group ${groupName} was not found`);
        await sequelize.close();
        return;
    }

    const hash = await bcrypt.hash(args[2], config.authentication.saltRounds);

    const [user, inserted] = await User.findOrCreate({
        where: { username: args[1] },
        defaults: {
            username: args[1],
            name: args[3],
            email: args[4],
            password: hash,
            groupId: group.id
        }
    });

    if (inserted) {
        console.log(`User with username ${user.username} has been created`);
    } else {
        console.log('A user that with username already exists!');
    }

    await sequelize.close();
};
