import databases from '../../submodules/database';

export default async (args) => {
    if (args.length < 2) {
        console.log('Invalid number of arguments');
        return;
    }

    let user = await databases.user.findOne({
        where: {
            username: args[1]
        }
    });

    await user.destroy();

    console.log('User has been deleted');
};
