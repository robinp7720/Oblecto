import { promises as fs } from 'fs';
import axiosTimeout from '../../submodules/axiosTimeout.js';
import logger from '../../submodules/logger/index.js';
import DebugExtendableError from '../errors/DebugExtendableError.js';
import Oblecto from '../oblecto/index.js';

export default class Downloader {
    public oblecto: Oblecto;

    /**
     *  Downloader module for oblecto
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.oblecto.queue.registerJob('downloadFile', async (job: any) => {
            await Downloader.download(job.url, job.dest, job.overwrite);
        });
    }

    /**
     *  Download a file
     * @param url - URL to download
     * @param dest - Destination path for file
     * @param overwrite - Overwrite if it it exists
     */
    static async download(url: string, dest: string, overwrite?: boolean): Promise<void> {
        let flags = 'wx';

        if (overwrite) {
            flags = 'w';
        }

        let { data } = await axiosTimeout({
            method: 'get',
            url,
            responseType: 'arraybuffer',
            // responseEncoding: 'binary' // Axios types might not have responseEncoding on the config directly or it might be renamed
        } as any);

        await fs.writeFile(dest, data, { flag: flags } as any);
    }

    /**
     *  Download the first url which doesn't return an error code
     * @param urls - Array of urls to attempt
     * @param path - Destination path for file
     */
    static async attemptDownload(urls: string[], path: string): Promise<void> {
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
