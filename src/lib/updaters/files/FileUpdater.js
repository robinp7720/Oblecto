import crypto from 'crypto';
import {promises as fs, createReadStream} from 'fs';
import ffprobe from '../../../submodules/ffprobe';
import VideoAnalysisError from '../../errors/VideoAnalysisError';


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

        this.oblecto.queue.addJob('updateFileFFProbe', async (file) => {
            await this.updateFileFFProbe(file);
        });
    }

    static async getPrimaryVideoStream(metadata) {
        let streams = metadata.streams;
        let primaryStream = {duration: 0};

        for (const stream of streams) {
            if (stream.duration || 1 >= primaryStream.duration) {
                if (stream['codec_type'] !=='video')
                    continue;

                primaryStream = stream;
            }
        }

        return primaryStream;
    }

    static async getPrimaryAudioStream(metadata) {
        let streams = metadata.streams;
        let primaryStream = {duration: 0};

        for (const stream of streams) {
            if (stream.duration || 1 >= primaryStream.duration) {
                if (stream['codec_type'] !=='audio')
                    continue;

                primaryStream = stream;
            }
        }

        return primaryStream;
    }

    /**
     *
     * @param {File} file
     * @returns {Promise<void>}
     */
    async updateFile(file) {
        if (this.oblecto.config.files.doHash && !file.hash) {
            this.oblecto.queue.queueJob('updateFileHash', file);
        }

        if (!file.size || file.size === 0) {
            this.oblecto.queue.queueJob('updateFileSize', file);
        }

        if (file.extension.includes('.')) {
            this.oblecto.queue.queueJob('updateFileExtension', file);
        }

        if (!file.duration || file.duration === 0) {
            this.oblecto.queue.queueJob('updateFileFFProbe', file);
        }
    }

    /**
     *
     * @param {File} file
     * @returns {Promise<string>}
     */
    getHashFromFile(file) {
        return new Promise((resolve, reject) => {
            let fd = createReadStream(file.path);
            let hash = crypto.createHash('sha1');

            hash.setEncoding('hex');

            fd.on('end', function() {
                hash.end();
                resolve(hash.read());
            });

            fd.on('error', () => {
                reject(new VideoAnalysisError(`Failed to calculate hash for ${file.path}`));
            });

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

    /**
     *
     * @param {File} file
     * @returns {Promise<void>}
     */
    async updateFileFFProbe(file) {
        let metadata;

        try {
            metadata = await ffprobe(file.path);
        } catch (e) {
            throw new VideoAnalysisError(`Failed to ffprobe ${file.path}`);
        }

        let primaryVideoStream = await FileUpdater.getPrimaryVideoStream(metadata);
        let primaryAudioStream = await FileUpdater.getPrimaryAudioStream(metadata);

        let duration = metadata.format.duration;

        if (isNaN(duration)) {
            throw new VideoAnalysisError(`Could not extract duration from ${file.path}`);
        }

        await file.update({
            duration,
            container: metadata.format['format_name'],
            videoCodec: primaryVideoStream['codec_name'],
            audioCodec: primaryAudioStream['codec_name']
        });
    }
}
