import { User } from '../../models/user.js';
import { Group } from '../../models/group.js';
import { initDatabase } from '../../submodules/database.js';
import { seedGroups } from '../../lib/auth/permissions.js';
import argumentError from './helpers/argumentError.js';

export default async (args: string[]): Promise<void> => {
    const sequelize = initDatabase();

    if (args.length < 3) {
        argumentError('usergroup', ['username', 'group']);
        await sequelize.close();
        return;
    }

    await seedGroups();

    const user = await User.findOne({ where: { username: args[1] } });
    const group = await Group.findOne({ where: { name: args[2] } });

    if (user == null) {
        console.log(`User ${args[1]} was not found, please check your spelling`);
    } else if (group == null) {
        const names = (await Group.findAll()).map(existing => existing.name).join(', ');

        console.log(`Group ${args[2]} was not found. Groups: ${names}`);
    } else {
        await user.update({ groupId: group.id });
        console.log(`User ${user.username} is now in ${group.name}`);
    }

    await sequelize.close();
};
