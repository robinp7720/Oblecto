import fs from 'fs';
import crypto from 'crypto';

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
        file.update({hash});
    }
}
