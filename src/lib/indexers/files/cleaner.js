import fs from 'fs';
import databases from '../../../submodules/database';

export default {
    async removedDeletedFiled () {
        let results = await databases.file.findAll();

        results.forEach((item) => {
            fs.stat(item.path, (err, stat) => {
                if (!err)
                    return false;

                console.log('Deleting', item.path, 'because the file doesn\'t exist anymore');
                item.destroy();
            });
        });

    },
};