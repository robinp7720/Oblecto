import crypto from 'crypto';
import {promises as fs} from 'fs';


export default class FileUpdater {

    /**
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.oblecto.queue.addJob('updateFile', async (file) => {
            await this.updateFile(file);
        });

        this.oblecto.queue.addJob('updateFileHash', async (file) => {
            await this.updateFileHash(file);
        });

        this.oblecto.queue.addJob('updateFileSize', async (file) => {
            await this.updateFileSize(file);
        });

        this.oblecto.queue.addJob('updateFileExtension', async (file) => {
            await this.updateFileExtension(file);
        });
    }

    /**
     *
     * @param {File} file
     * @returns {Promise<void>}
     */
    async updateFile(file) {
        console.log('Updating file ' + file.name);

        if (this.oblecto.config.files.doHash && !file.hash) {
            this.oblecto.queue.queueJob('updateFileHash', file);
        }

        if (!file.size || file.size === 0) {
            this.oblecto.queue.queueJob('updateFileSize', file);
        }

        if (file.extension.includes('.')) {
            this.oblecto.queue.queueJob('updateFileExtension', file);
        }
    }

    /**
     *
     * @param {File} file
     * @returns {Promise<string>}
     */
    getHashFromFile(file) {
        return new Promise((resolve, reject) => {
            let fd = fs.createReadStream(file.path);
            let hash = crypto.createHash('sha1');

            hash.setEncoding('hex');

            fd.on('end', function() {
                hash.end();
                resolve(hash.read());
            });

            fd.on('error', reject);

            fd.pipe(hash);
        });
    }

    /**
     *
     * @param {File} file
     * @returns {Promise<void>}
     */
    async updateFileHash(file) {
        let hash = await this.getHashFromFile(file);
        await file.update({hash});
    }

    /**
     *
     * @param {File} file
     * @returns {Promise<void>}
     */
    async updateFileSize(file) {
        let size = (await fs.stat(file.path)).size;
        await file.update({size});
    }

    /**
     *
     * @param {File} file
     * @returns {Promise<void>}
     */
    async updateFileExtension(file) {
        let extension = file.extension.replace('.','');
        await file.update({extension});
    }
}
