import recursive from 'recursive-readdir';
import queue from '../../../submodules/queue';
import config from '../../../config';

export default {
    async CollectDirectory(Directory) {
        console.log('Indexing', Directory);
        let files = await recursive(Directory);

        files.forEach(file => {
            console.log('Pushing file', file, 'to queue');
            queue.push({task: 'episode', path: file}, function (err) {

            });
        });
    },

    async CollectAll() {
        config.tvshows.directories.forEach(directory => {
            this.CollectDirectory(directory.path);
        });
    }
};