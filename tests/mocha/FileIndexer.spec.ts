import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import FileIndexer from '../../src/lib/indexers/files/FileIndexer.js';
import Queue from '../../src/lib/queue/index.js';
import ffmpegModule from '../../src/submodules/ffmpeg.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Stream, streamColumns } from '../../src/models/stream.js';
import FileExistsError from '../../src/lib/errors/FileExistsError.js';
import VideoAnalysisError from '../../src/lib/errors/VideoAnalysisError.js';
import logger from '../../src/submodules/logger/index.js';

import type { FfprobeData } from 'fluent-ffmpeg';
import type Oblecto from '../../src/lib/oblecto/index.js';

describe('FileIndexer', () => {
    let sequelize: Sequelize;
    const originalFfprobe = (ffmpegModule as any).ffprobe;

    before(async () => {
        logger.silent = true;

        sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

        File.init(fileColumns, { sequelize, modelName: 'File' });
        Stream.init(streamColumns, { sequelize, modelName: 'Stream' });

        File.hasMany(Stream);
        Stream.belongsTo(File);

        await sequelize.sync({ force: true });
    });

    after(() => {
        logger.silent = false;
        (ffmpegModule as any).ffprobe = originalFfprobe;
    });

    afterEach(async () => {
        (ffmpegModule as any).ffprobe = originalFfprobe;
        await Stream.destroy({ where: {}, truncate: true });
        await File.destroy({ where: {}, truncate: true });
    });

    const makeOblecto = (collectFile: (file: File) => Promise<void> = async () => {}) => ({
        queue: new Queue(1),
        fileUpdateCollector: { collectFile }
    }) as unknown as Oblecto;

    describe('indexVideoFile', () => {
        it('creates a new file record with parsed name/directory/extension', async () => {
            let collectedFile: File | undefined;
            const indexer = new FileIndexer(makeOblecto(async (file) => { collectedFile = file; }));

            const file = await indexer.indexVideoFile('/media/Movies/Catch-22.mkv');

            assert.equal(file.host, 'local');
            assert.equal(file.name, 'Catch-22');
            assert.equal(file.directory, '/media/Movies');
            assert.equal(file.extension, 'mkv');
            assert.equal(collectedFile?.id, file.id);
        });

        it('throws FileExistsError when the file path is already indexed', async () => {
            const indexer = new FileIndexer(makeOblecto());

            await indexer.indexVideoFile('/media/dup.mkv');

            await assert.rejects(() => indexer.indexVideoFile('/media/dup.mkv'), FileExistsError);
        });
    });

    describe('indexVideoFileStreams', () => {
        const makeMetadata = (): FfprobeData => ({
            streams: [
                {
                    id: '0x1',
                    index: 0,
                    codec_name: 'h264',
                    codec_type: 'video',
                    codec_long_name: 'H.264',
                    codec_tag: '0x0000',
                    disposition: { default: 1, forced: 0 },
                    tags: { language: 'eng', title: 'Main' },
                    width: 'N/A' as any
                }
            ] as any,
            format: {} as any,
            chapters: []
        });

        it('creates a Stream record per ffprobe stream, mapping disposition and tags', async () => {
            (ffmpegModule as any).ffprobe = (path: string, cb: (err: any, data: any) => void) => cb(null, makeMetadata());

            const indexer = new FileIndexer(makeOblecto());
            const file = await File.create({ path: '/media/x.mkv', host: 'local' });

            await indexer.indexVideoFileStreams(file);

            const streams = await Stream.findAll({ where: { FileId: file.id } });
            assert.equal(streams.length, 1);

            const stream = streams[0];
            assert.equal(stream.codec_name, 'h264');
            assert.equal(stream.stream_id, '0x1');
            assert.equal(stream.disposition_default, 1);
            assert.equal(stream.disposition_forced, 0);
            assert.equal(stream.tags_language, 'eng');
            assert.equal(stream.tags_title, 'Main');
            assert.equal((stream as any).width, null);
        });

        it('is idempotent for the same stream on repeated calls (findOrCreate)', async () => {
            (ffmpegModule as any).ffprobe = (path: string, cb: (err: any, data: any) => void) => cb(null, makeMetadata());

            const indexer = new FileIndexer(makeOblecto());
            const file = await File.create({ path: '/media/y.mkv', host: 'local' });

            await indexer.indexVideoFileStreams(file);
            await indexer.indexVideoFileStreams(file);

            const streams = await Stream.findAll({ where: { FileId: file.id } });
            assert.equal(streams.length, 1);
        });

        it('marks the file problematic and throws VideoAnalysisError when probing fails', async () => {
            (ffmpegModule as any).ffprobe = (path: string, cb: (err: any, data: any) => void) => cb(new Error(`ffprobe error: ${path}: Invalid data found`), null);

            const indexer = new FileIndexer(makeOblecto());
            const file = await File.create({ path: '/media/broken.mkv', host: 'local' });

            await assert.rejects(() => indexer.indexVideoFileStreams(file), VideoAnalysisError);

            await file.reload();
            assert.equal(file.problematic, true);
            assert.ok(file.error);
        });
    });
});
