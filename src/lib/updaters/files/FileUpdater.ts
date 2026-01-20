import crypto from 'crypto';
import { promises as fs, createReadStream } from 'fs';
import type { FfprobeData, FfprobeStream } from 'fluent-ffmpeg';

import ffprobe from '../../../submodules/ffprobe.js';
import VideoAnalysisError from '../../errors/VideoAnalysisError.js';

import { File } from '../../../models/file.js';

import type Oblecto from '../../oblecto/index.js';

export default class FileUpdater {
    public oblecto: Oblecto;

    /**
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.oblecto.queue.registerJob('updateFile', async (file: File) => {
            await this.updateFile(file);
        });

        this.oblecto.queue.registerJob('updateFileHash', async (file: File) => {
            await this.updateFileHash(file);
        });

        this.oblecto.queue.registerJob('updateFileSize', async (file: File) => {
            await this.updateFileSize(file);
        });

        this.oblecto.queue.registerJob('updateFileExtension', async (file: File) => {
            await this.updateFileExtension(file);
        });

        this.oblecto.queue.registerJob('updateFileFFProbe', async (file: File) => {
            await this.updateFileFFProbe(file);
        });
    }

    static async getPrimaryVideoStream(metadata: FfprobeData): Promise<FfprobeStream | null> {
        const streams = metadata.streams ?? [];
        let primaryStream: FfprobeStream | null = null;
        let primaryDuration = 0;

        for (const stream of streams) {
            if (stream.codec_type !== 'video')
                continue;

            const duration = typeof stream.duration === 'number' ? stream.duration : 0;

            if (duration >= primaryDuration) {
                primaryStream = stream;
                primaryDuration = duration;
            }
        }

        return primaryStream;
    }

    static async getPrimaryAudioStream(metadata: FfprobeData): Promise<FfprobeStream | null> {
        const streams = metadata.streams ?? [];
        let primaryStream: FfprobeStream | null = null;
        let primaryDuration = 0;

        for (const stream of streams) {
            if (stream.codec_type !== 'audio')
                continue;

            const duration = typeof stream.duration === 'number' ? stream.duration : 0;

            if (duration >= primaryDuration) {
                primaryStream = stream;
                primaryDuration = duration;
            }
        }

        return primaryStream;
    }

    /**
     * @param file - Update relevant metadata for a file
     */
    async updateFile(file: File): Promise<void> {
        if (this.oblecto.config.files.doHash && !file.hash) {
            this.oblecto.queue.lowPriorityJob('updateFileHash', file);
        }

        if (!file.size || file.size === 0) {
            this.oblecto.queue.queueJob('updateFileSize', file);
        }

        if (file.extension?.includes('.')) {
            this.oblecto.queue.queueJob('updateFileExtension', file);
        }

        if (!file.duration || file.duration === 0) {
            this.oblecto.queue.queueJob('updateFileFFProbe', file);
        }

        const streamCount = await file.countStreams();

        if (streamCount === 0) {
            this.oblecto.queue.queueJob('indexFileStreams', file);
        }
    }

    /**
     * @param file - File to get hash fore
     * @returns - File hash
     */
    getHashFromFile(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const fd = createReadStream(file.path as string);
            const hash = crypto.createHash('sha1');

            hash.setEncoding('hex');

            fd.on('end', function() {
                hash.end();
                resolve(hash.read() as string);
            });

            fd.on('error', () => {
                reject(new VideoAnalysisError(`Failed to calculate hash for ${file.path}`));
            });

            fd.pipe(hash);
        });
    }

    /**
     * @param file - Update the file hash in the database
     */
    async updateFileHash(file: File): Promise<void> {
        const hash = await this.getHashFromFile(file);

        await file.update({ hash });
    }

    /**
     * @param file - Update the file size in the database
     */
    async updateFileSize(file: File): Promise<void> {
        const size = (await fs.stat(file.path as string)).size;

        await file.update({ size });
    }

    /**
     * @param file - Update the file extension in the database
     */
    async updateFileExtension(file: File): Promise<void> {
        const extension = (file.extension ?? '').replace('.','');

        await file.update({ extension });
    }

    /**
     * @param file - Update the streams index
     */
    async updateFileFFProbe(file: File): Promise<void> {
        let metadata: FfprobeData;

        try {
            metadata = await ffprobe(file.path as string);
        } catch (e) {
            const error = e as Error;
            const lines = (error.message ?? '').split('\n');
            const lastLine = lines[lines.length - 1];

            throw new VideoAnalysisError(`Failed to ffprobe ${file.path}: ${lastLine}`);
        }

        const primaryVideoStream = await FileUpdater.getPrimaryVideoStream(metadata);
        const primaryAudioStream = await FileUpdater.getPrimaryAudioStream(metadata);

        const duration = metadata.format?.duration ?? NaN;

        if (isNaN(duration)) {
            throw new VideoAnalysisError(`Could not extract duration from ${file.path}`);
        }

        await file.update({
            duration,
            container: metadata.format?.format_name,
            videoCodec: primaryVideoStream?.codec_name,
            audioCodec: primaryAudioStream?.codec_name
        });
    }
}
