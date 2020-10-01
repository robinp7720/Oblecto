import {File} from '../../../models/file';

import Path from 'path';
import FileExistsError from '../../errors/FileExistsError';

export default class FileIndexer {

    /**
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async indexVideoFile(videoPath) {
        let parsedPath = Path.parse(videoPath);

        let [file, fileInserted] = await File.findOrCreate({
            where: {path: videoPath},
            defaults: {
                host: 'local',
                name: parsedPath.name,
                directory: parsedPath.dir,
                extension: parsedPath.ext.replace('.',''),
            }
        });

        if (!fileInserted) {
            throw new FileExistsError();
        }

        await this.oblecto.fileUpdateCollector.collectFile(file);

        return file;
    }
}
