import {promises as fs} from 'fs';
import axiosTimeout from '../../submodules/axiosTimeout';
import logger from '../../submodules/logger';
import DebugExtendableError from '../errors/DebugExtendableError';

export default class Downloader {
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.oblecto.queue.registerJob('downloadFile', async (job) => {
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

    static async attemptDownload(urls, path) {
        for (let url of urls) {
            try {
                await Downloader.download(
                    url,
                    path,
                );

                return;
            } catch (err) {
                logger.log('DEBUG', `Error while downloading ${url}. Continuing to next url`);
            }
        }

        throw new DebugExtendableError('Failed to download any url from array');
    }

}
