import {promises as fs} from 'fs';
import axiosTimeout from '../../submodules/axiosTimeout';

export default class Downloader {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.oblecto.queue.addJob('downloadFile', async (job) => {
            await Downloader.download(job.url, job.dest, job.overwrite);
        });
    }

    static async download(url, dest, overwrite) {
        let writeMode = 'wx';

        if (overwrite) {
            writeMode = 'w';
        }

        let response = await axiosTimeout({
            method: 'get',
            url: url,
            responseType: 'arraybuffer',
            responseEncoding: 'binary'
        });

        await fs.writeFile(dest, response.data, {flags: writeMode});
    }
}
