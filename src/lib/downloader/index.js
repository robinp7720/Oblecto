import { promises as fs } from 'fs';
import axiosTimeout from '../../submodules/axiosTimeout';
import logger from '../../submodules/logger';
import DebugExtendableError from '../errors/DebugExtendableError';

/**
 * @typedef {import('../oblecto').default} Oblecto
 */

export default class Downloader {
    /**
     *  Downloader module for oblecto
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.oblecto.queue.registerJob('downloadFile', async (job) => {
            await Downloader.download(job.url, job.dest, job.overwrite);
        });
    }

    /**
     *  Download a file
     * @param {string} url - URL to download
     * @param {string} dest - Destination path for file
     * @param {boolean} overwrite - Overwrite if it it exists
     * @returns {Promise<void>}
     */
    static async download(url, dest, overwrite) {
        let flags = 'wx';

        if (overwrite) {
            flags = 'w';
        }

        let { data } = await axiosTimeout({
            method: 'get',
            url,
            responseType: 'arraybuffer',
            responseEncoding: 'binary'
        });

        await fs.writeFile(dest, data, { flags });
    }

    /**
     *  Download the first url which doesn't return an error code
     * @param {string[]} urls - Array of urls to attempt
     * @param {string} path - Destination path for file
     * @returns {Promise<void>}
     */
    static async attemptDownload(urls, path) {
        for (let url of urls) {
            try {
                await Downloader.download(
                    url,
                    path,
                );

                return;
            } catch (err) {
                logger.debug( `Error while downloading ${url}. Continuing to next url`);
            }
        }

        throw new DebugExtendableError('Failed to download any url from array');
    }

}
