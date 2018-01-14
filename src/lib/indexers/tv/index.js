import recursive from "recursive-readdir"
import queue from "../../../submodules/queue";
import config from "../../../config";

export default {
    async indexDirectory(Directory) {
        let files = await recursive(Directory);

        files.forEach(file => {
            queue.push({task: "episode", path: file}, function (err) {

            });
        })
    },

    async indexAll() {
        config.tvshows.directories.forEach(directory => {
            this.indexDirectory(directory.path)
        });
    }
}