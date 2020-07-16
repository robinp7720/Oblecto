import axios from 'axios';
import {promises as fs} from 'fs';

let axiosTimeout = function (options) {
    return new Promise(async function(resolve, reject) {
        let timedout = false;
        let timeout = setTimeout(() => {
            timedout = true;

            reject(new Error('Timeout'));
        }, 5000);


        try {
            let response = await axios(options);

            if (timedout) return;

            clearTimeout(timeout);

            resolve(response);
        } catch (e) {
            console.log(e);
            clearTimeout(timeout);
            return reject(e);
        }

    });
};

export default class Downloader {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.oblecto.queue.addJob('downloadFile', async (job) => {
            await Downloader.download(job.url, job.dest, job.overwrite);
        });
    }

    static async download(url, dest, overwrite) {
        let writeMode = 'wx';

        if (overwrite === true) {
            writeMode = 'w';
        }

        console.log('Starting download');

        try {
            let response = await axiosTimeout({
                method: 'get',
                url: url,
                responseType: 'arraybuffer',
                responseEncoding: 'binary'
            });

            await fs.writeFile(dest, response.data, {flags: writeMode});

            console.log('Downloaded');
        } catch (e) {
            throw e;
        }
    }
}
