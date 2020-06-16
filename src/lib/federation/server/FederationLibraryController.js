import databases from '../../../submodules/database';

export default {
    async sendLibrary (client) {
        let results = await databases.file.findAll({
            include: [databases.movie, databases.episode]
        });

        results.forEach((item) => {
            client.write(JSON.stringify(item.toJSON()) + '\r\n');
        });
    }
};
