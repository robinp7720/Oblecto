import path from 'path';
import type { InferCreationAttributes } from 'sequelize';

import { File } from '../../../models/file.js';
import { Stream } from '../../../models/stream.js';
import FileExistsError from '../../errors/FileExistsError.js';
import VideoAnalysisError from '../../errors/VideoAnalysisError.js';
import ffprobe from '../../../submodules/ffprobe.js';
import logger from '../../../submodules/logger/index.js';

import type { FfprobeData } from 'fluent-ffmpeg';
import type Oblecto from '../../oblecto/index.js';

type StreamMetadata = Record<string, unknown> & {
    disposition?: Record<string, number | null | undefined>;
    tags?: {
        language?: string;
        title?: string;
    };
    id?: string | number;
    index?: number | null;
    codec_name?: string | null;
};

type StreamRecord = Record<string, unknown> & {
    FileId: number;
    stream_id?: string | number | null;
    index?: number | null;
    codec_name?: string | null;
    tags_language?: string;
    tags_title?: string;
};

export default class FileIndexer {
    public oblecto: Oblecto;

    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.oblecto.queue.registerJob('indexFileStreams', this.indexVideoFileStreams);
    }

    /**
     *
     * @param videoPath
     * @returns {File}
     */
    async indexVideoFile(videoPath: string): Promise<File> {
        const parsedPath = path.parse(videoPath);

        const [file, fileInserted] = await File.findOrCreate({
            where: { path: videoPath },
            defaults: {
                host: 'local',
                name: parsedPath.name,
                directory: parsedPath.dir,
                extension: parsedPath.ext.replace('.', '')
            }
        });

        if (!fileInserted) {
            throw new FileExistsError(`${videoPath} is already in the file database`);
        }

        await this.oblecto.fileUpdateCollector.collectFile(file);

        return file;
    }

    async indexVideoFileStreams(file: File): Promise<void> {
        logger.debug( `Indexing streams for ${file.path}`);

        let metadata: FfprobeData;

        try {
            metadata = await ffprobe(file.path as string);
        } catch (e) {
            const error = e as Error;
            const message = typeof error.message === 'string' ? error.message : '';
            const lines = message.trim().split('\n');
            let lastLine = lines[lines.length - 1];

            // Remove file path from error if present to make it concise
            if (lastLine?.includes(file.path as string)) {
                lastLine = lastLine.replace(file.path as string, '').replace(/^:\s*/, '').trim();
            }

            const errorMsg = lastLine || 'Unknown error';

            await file.update({ problematic: true, error: errorMsg });

            throw new VideoAnalysisError(`Failed to probe ${file.path}: ${errorMsg}`);
        }

        for (const streamBaseRaw of metadata.streams) {
            const streamBase = streamBaseRaw as StreamMetadata;

            for (const key of Object.keys(streamBase)) {
                if (streamBase[key] === 'N/A' || streamBase[key] === 'unknown') {
                    streamBase[key] = null;
                }
            }

            const disposition = streamBase.disposition ?? {};

            const stream: StreamRecord = {
                FileId: file.id,
                stream_id: streamBase.id ?? null,
                disposition_default: disposition.default ?? null,
                disposition_dub: disposition.dub ?? null,
                disposition_original: disposition.original ?? null,
                disposition_comment: disposition.comment ?? null,
                disposition_lyrics: disposition.lyrics ?? null,
                disposition_karaoke: disposition.karaoke ?? null,
                disposition_forced: disposition.forced ?? null,
                disposition_hearing_impaired: disposition.hearing_impaired ?? null,
                disposition_clean_effects: disposition.clean_effects ?? null,
                disposition_attached_pic: disposition.attached_pic ?? null,
                disposition_timed_thumbnails: disposition.timed_thumbnails ?? null,
                ...streamBase
            };

            if (streamBase.tags) {
                stream.tags_language = streamBase.tags.language;
                stream.tags_title = streamBase.tags.title;

                delete stream.tags;
            }

            delete stream.id;
            delete stream.disposition;

            delete stream.codec_long_name;
            delete stream.codec_tag;

            await Stream.findOrCreate({
                where: {
                    FileId: stream.FileId,
                    stream_id: stream.stream_id,
                    index: stream.index,
                    codec_name: stream.codec_name,
                },
                defaults: stream as InferCreationAttributes<Stream>
            });
        }
    }
}
