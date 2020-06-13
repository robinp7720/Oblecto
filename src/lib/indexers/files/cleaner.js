import fs from 'mz/fs';
import databases from '../../../submodules/database';

export default {
    async removedDeletedFiled () {
        console.log('Scanning for deleted files');
        let results = await databases.file.findAll();

        for (let i in results) {
            let item = results[i];
            if (!await fs.exists(item.path)) {
                console.log('Deleting', item.path, 'because the file doesn\'t exist anymore');
                await item.destroy();
            }
        }

    },
    async removeAssoclessFiles () {
        console.log('Scanning for files without associated media entities');

        let results = await databases.file.findAll({
            include: [databases.movie, databases.episode]
        });

        results.forEach((item) => {
            if (item.movies.length === 0 && item.episodes.length === 0) {
                console.log('Deleting', item.path, 'because the file doesn\'t have any media entities associated')
                item.destroy();
            }
        });

    },
};
