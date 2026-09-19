import { User } from '../../models/user.js';
import { openDatabase } from './helpers/openDatabase.js';
import { LockoutError, countAdmins, withAdminGuard } from '../../lib/auth/permissions.js';
import argumentError from './helpers/argumentError.js';

export default async (args: string[]): Promise<void> => {
    if (args.length < 2) {
        argumentError('deluser', ['username']);
        return;
    }

    const sequelize = await openDatabase();

    try {
        const user = await User.findOne({ where: { username: args[1] } });

        if (!user) {
            console.log(`User ${args[1]} was not found, please check your spelling`);
            return;
        }

        // Refuse to remove the last administrator; with none to begin with there is nothing to protect.
        if (await countAdmins() > 0) await withAdminGuard(transaction => user.destroy({ transaction }));
        else await user.destroy();

        console.log('User has been deleted');
    } catch (error) {
        if (!(error instanceof LockoutError)) throw error;
        console.log(`${args[1]} is the last administrator. Make someone else one first: oblecto usergroup USERNAME Administrators`);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
};
