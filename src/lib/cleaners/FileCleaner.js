import {promises as fs} from 'fs';
import {File} from '../../models/file';
import {Movie} from '../../models/movie';
import {Episode} from '../../models/episode';

export default class FileCleaner{
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async removedDeletedFiled () {
        let results = await File.findAll();

        for (let item of results) {
            if (await fs.stat(item.path)) continue;

            await item.destroy();

        }

    }

    async removeAssoclessFiles () {
        let results = await File.findAll({
            include: [Movie, Episode]
        });

        results.forEach((item) => {
            if (item.Movies.length === 0 && item.Episodes.length === 0) {
                item.destroy();
            }
        });
    }
}
