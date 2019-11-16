import recursive from 'recursive-readdir';
import queue from '../../../submodules/queue';
import config from '../../../config';
import path from 'path';

export default {
    async CollectDirectory(Directory, doReIndex) {
        console.log('Indexing', Directory);
        let files = await recursive(Directory);

        files.forEach(file => {
            this.CollectFile(file, doReIndex);
        });
    },

    async CollectFile(file, doReIndex) {
        console.log('Pushing file', file, 'to queue');
        let extension = path.parse(file).ext.toLowerCase();

        if (config.fileExtensions.video.indexOf(extension) !== -1) {
            queue.push({task: 'episode', path: file, doReIndex}, function (err) {

            });
        }
    },

    async CollectAll() {
        config.tvshows.directories.forEach(directory => {
            this.CollectDirectory(directory.path);
        });
    }
};
