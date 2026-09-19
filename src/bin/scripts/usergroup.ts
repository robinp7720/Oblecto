import { User } from '../../models/user.js';
import { Group } from '../../models/group.js';
import { openDatabase } from './helpers/openDatabase.js';
import { LockoutError, countAdmins, seedGroups, withAdminGuard } from '../../lib/auth/permissions.js';
import argumentError from './helpers/argumentError.js';

export default async (args: string[]): Promise<void> => {
    const sequelize = await openDatabase();

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
        try {
            // Refuse to demote the last administrator; with none to begin with there is nothing to protect.
            if (await countAdmins() > 0) await withAdminGuard(transaction => user.update({ groupId: group.id }, { transaction }));
            else await user.update({ groupId: group.id });
            console.log(`User ${user.username} is now in ${group.name}`);
        } catch (error) {
            if (!(error instanceof LockoutError)) throw error;
            console.log(`${user.username} is the last administrator. Make someone else one first.`);
            process.exitCode = 1;
        }
    }

    await sequelize.close();
};
