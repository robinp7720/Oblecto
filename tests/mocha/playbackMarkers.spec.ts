/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import express from 'express';
import type { Server } from 'node:http';
import { Sequelize } from 'sequelize';

import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import { parseChapters, segmentTypeForTitle, segmentsFromChapters } from '../../src/lib/analysis/chapters.js';
import { detectSharedSegments, findSharedRange, fingerprintRegions, POINT_SECONDS } from '../../src/lib/analysis/fingerprint.js';
import { validateSegments } from '../../src/lib/analysis/segments.js';
import { thumbnailHeight } from '../../src/lib/analysis/trickplay.js';
import MediaAnalyser from '../../src/lib/analysis/MediaAnalyser.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { EpisodeFiles, episodeFilesColumns } from '../../src/models/episodeFiles.js';
import { MovieFiles, movieFileColumns } from '../../src/models/movieFiles.js';
import { User } from '../../src/models/user.js';
import config from '../../src/config.js';
import { issueAccessToken } from '../../src/lib/auth/tokens.js';
import streamingRoutes from '../../src/submodules/REST/routes/streaming.js';
import { PlaybackService } from '../../src/lib/playback/PlaybackService.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import type { OblectoRequest } from '../../src/submodules/REST/index.js';

const run = promisify(execFile);

// Deterministic pseudo-random 32-bit values
function points(seed: number, length: number): Uint32Array {
    const out = new Uint32Array(length);
    let state = seed;

    for (let i = 0; i < length; i++) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        out[i] = state;
    }

    return out;
}

// Flip `bits` low bits of two values in three, as re-encoded audio does to a fingerprint
const blur = (values: Uint32Array, bits: number): Uint32Array => values.map((value, i) => (i % 3 ? value ^ ((1 << bits) - 1) : value) >>> 0);

const join = (...parts: Uint32Array[]): Uint32Array => {
    const out = new Uint32Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;

    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }

    return out;
};

const seconds = (value: number): number => Math.round(value / POINT_SECONDS);

describe('Playback markers', () => {
    describe('chapters', () => {
        it('reads ffprobe JSON and fluent-ffmpeg chapters, in order, inside the file', () => {
            assert.deepEqual(parseChapters([
                { start_time: '600.5', end_time: '1300', tags: { title: ' Credits ' } },
                { start_time: '0.000000', end_time: '90.000000', tags: { title: 'Intro' } },
                { start_time: 90, end_time: 600.5, 'TAG:title': 'Part 1' },
                { start_time: 'N/A', end_time: '10' },
                { start_time: '5', end_time: '5' },
                null
            ], 1200), [
                { start: 0, end: 90, title: 'Intro' },
                { start: 90, end: 600.5, title: 'Part 1' },
                { start: 600.5, end: 1200, title: 'Credits' }
            ]);
            assert.deepEqual(parseChapters(undefined), []);
            assert.deepEqual(parseChapters([{ start_time: '0', end_time: '30', tags: { title: 'N/A' } }]), [{ start: 0, end: 30, title: null }]);
        });

        it('recognises whole titles that name intros, credits, recaps and previews', () => {
            for (const title of ['Intro', 'OPENING', 'Opening Credits', 'OP', 'OP2', 'op_1', 'Main Title']) assert.equal(segmentTypeForTitle(title), 'intro', title);
            for (const title of ['Credits', 'End Credits', 'Ending', 'ED', 'Outro', 'closing credits']) assert.equal(segmentTypeForTitle(title), 'credits', title);
            for (const title of ['Recap', 'Previously on Lost']) assert.equal(segmentTypeForTitle(title), 'recap', title);
            for (const title of ['Preview', 'Next Episode', 'Next time on Show']) assert.equal(segmentTypeForTitle(title), 'preview', title);
            for (const title of ['Introduction', 'Chapter 1', 'Prologue', 'Credits Scene', 'Teaser', null]) assert.equal(segmentTypeForTitle(title), null, String(title));
        });

        it('turns named chapters into segments, merging neighbours of the same kind', () => {
            assert.deepEqual(segmentsFromChapters([
                { start: 0, end: 40, title: 'Recap' },
                { start: 40, end: 100, title: 'Opening' },
                { start: 100, end: 1300, title: 'Part A' },
                { start: 1300, end: 1360, title: 'Ending' },
                { start: 1360, end: 1380, title: 'Credits' },
                { start: 1380, end: 1410, title: 'Preview' },
                { start: 1410, end: 1410.5, title: 'Intro' }
            ]), [
                { type: 'recap', start: 0, end: 40, source: 'chapters' },
                { type: 'intro', start: 40, end: 100, source: 'chapters' },
                { type: 'credits', start: 1300, end: 1380, source: 'chapters' },
                { type: 'preview', start: 1380, end: 1410, source: 'chapters' }
            ]);
        });
    });

    describe('fingerprint matching', () => {
        const intro = points(7, seconds(45));

        it('finds audio two episodes share, wherever it starts in each', () => {
            const a = join(points(1, seconds(20)), intro, points(2, seconds(120)));
            const b = join(points(3, seconds(6)), blur(intro, 3), points(4, seconds(120)));
            const shared = findSharedRange(a, b)!;

            assert.ok(Math.abs(shared.aStart - 20) < 0.5, `${shared.aStart}`);
            assert.ok(Math.abs(shared.aEnd - 65) < 0.5, `${shared.aEnd}`);
            assert.ok(Math.abs(shared.bStart - 6) < 0.5, `${shared.bStart}`);
            assert.ok(Math.abs(shared.bEnd - 51) < 0.5, `${shared.bEnd}`);
        });

        it('finds nothing in unrelated audio, in silence, or in a match shorter than asked for', () => {
            assert.equal(findSharedRange(points(1, seconds(200)), points(2, seconds(200))), null);

            const silence = new Uint32Array(seconds(60)).fill(0x5555aaaa);

            assert.equal(findSharedRange(join(points(1, 100), silence), join(points(2, 300), silence)), null);
            assert.equal(findSharedRange(join(points(1, 100), points(9, seconds(10))), join(points(2, 50), points(9, seconds(10)))), null);
        });

        it('gives each episode of a season the intro and credits it shares with its neighbours', () => {
            const credits = points(8, seconds(30));
            const episode = (id: number, coldOpen: number, ending: Uint32Array) => {
                const duration = 1500;
                const regions = fingerprintRegions(duration);
                const tail = join(points(id * 10, seconds(regions.credits[1] - 30)), ending);

                return {
                    id,
                    duration,
                    intro: { offset: 0, points: join(points(id * 10 + 1, seconds(coldOpen)), intro, points(id * 10 + 2, seconds(regions.intro[1] - coldOpen - 45))) },
                    credits: { offset: regions.credits[0], points: tail }
                };
            };
            const season = [episode(1, 0.5, credits), episode(2, 90, credits), episode(3, 30, points(99, seconds(30)))];
            const found = detectSharedSegments(season);

            // Starting within the first second counts as the start
            assert.equal(found.get(1)!.intro![0], 0);
            assert.ok(Math.abs(found.get(2)!.intro![0] - 90) < 0.5);
            assert.ok(Math.abs(found.get(3)!.intro![1] - 75) < 0.5);
            // Credits that run to the end end with the file
            assert.ok(Math.abs(found.get(1)!.credits![0] - 1470) < 0.5);
            assert.equal(found.get(1)!.credits![1], 1500);
            assert.equal(found.get(3)!.credits, undefined);

            assert.deepEqual([...detectSharedSegments(season, new Set([3])).keys()], [3]);
        });
    });

    it('validates segments set by hand', () => {
        assert.deepEqual(validateSegments([{ type: 'credits', start: 1300, end: 1400.5 }, { type: 'intro', start: 10, end: 70 }], 1400), {
            segments: [
                { type: 'intro', start: 10, end: 70, source: 'manual' },
                { type: 'credits', start: 1300, end: 1400, source: 'manual' }
            ]
        });
        for (const input of [null, [{ type: 'ads', start: 0, end: 1 }], [{ type: 'intro', start: 5, end: 5 }], [{ type: 'intro', start: -1, end: 5 }], [{ type: 'intro', start: '0', end: 5 }], [{ type: 'intro', start: 0, end: 2000 }], [{ type: 'intro', start: 1400.2, end: 1400.5 }]]) {
            assert.ok('error' in validateSegments(input, 1400), JSON.stringify(input));
        }
    });

    it('sizes thumbnails by display aspect ratio', () => {
        assert.equal(thumbnailHeight({ index: 0, width: 1920, height: 1080 }, 320), 180);
        assert.equal(thumbnailHeight({ index: 0, width: 720, height: 576, sample_aspect_ratio: '64:45' }, 320), 180);
        assert.equal(thumbnailHeight({ index: 0, width: 1920, height: 800 }, 320), 134);
    });

    describe('analysing a library with FFmpeg', function () {
        this.timeout(180000);

        let sequelize: Sequelize;
        let root: string;
        let analyser: MediaAnalyser;
        let chromaprint = false;
        const jobs = new Map<string, (attr: unknown) => Promise<void>>();
        const queued: [string, unknown][] = [];
        const settings = { trickplay: true, trickplayInterval: 10, detectSegments: true };

        // Each episode: a cold open, the shared intro, its own story, then the shared credits. The
        // episode's own parts are a pseudo-random melody, a new note every quarter second: steady
        // tones or noise fingerprint too much alike to stand in for dialogue.
        const melody = (seed: number, duration: number): string => {
            const hash = `sin(floor(t*4)*12.9898+${seed}*78.233)*43758.5453`;

            return `aevalsrc='0.3*sin(2*PI*220*pow(2,floor(24*(${hash}-floor(${hash})))/12)*t)':s=44100:d=${duration}`;
        };
        const INTRO = "aevalsrc='0.3*sin(2*PI*(220+110*floor(mod(t*2,8)))*t)+0.2*sin(2*PI*(330+55*floor(mod(t*3,5)))*t)':s=44100:d=40";
        const CREDITS = "aevalsrc='0.3*sin(2*PI*(660-60*floor(mod(t*1.5,7)))*t)+0.2*sin(2*PI*(150+40*floor(mod(t*2.5,4)))*t)':s=44100:d=30";

        async function makeEpisode(name: string, seed: number, coldOpen: number, story: number): Promise<string> {
            const output = path.join(root, name);
            const duration = coldOpen + 40 + story + 30;

            await run('ffmpeg', [
                '-v', 'error', '-y',
                '-f', 'lavfi', '-i', `testsrc2=size=160x90:rate=5:duration=${duration}`,
                '-f', 'lavfi', '-i', melody(seed * 2, coldOpen),
                '-f', 'lavfi', '-i', INTRO,
                '-f', 'lavfi', '-i', melody(seed * 2 + 1, story),
                '-f', 'lavfi', '-i', CREDITS,
                '-filter_complex', '[1]aresample=44100[a1];[2]aresample=44100[a2];[3]aresample=44100[a3];[4]aresample=44100[a4];[a1][a2][a3][a4]concat=n=4:v=0:a=1[a]',
                '-map', '0:v', '-map', '[a]',
                '-c:v', 'libx264', '-preset', 'ultrafast', '-g', '25', '-pix_fmt', 'yuv420p', '-threads', '2',
                '-c:a', 'aac', output
            ]);

            return output;
        }

        async function runQueued(): Promise<void> {
            while (queued.length) {
                const [id, attr] = queued.shift()!;
                await jobs.get(id)!(attr);
            }
        }

        // Join rows are written directly: other specs leave association helpers such as
        // episode.addFile bound to their own, closed, databases.
        before(async () => {
            chromaprint = (await run('ffmpeg', ['-hide_banner', '-muxers'])).stdout.includes('chromaprint');
            root = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-markers-'));
            sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });

            File.init(fileColumns, { sequelize, modelName: 'File' });
            Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
            Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
            Series.init(seriesColumns, { sequelize, modelName: 'Series' });
            EpisodeFiles.init(episodeFilesColumns, { sequelize, modelName: 'EpisodeFiles' });
            MovieFiles.init(movieFileColumns, { sequelize, modelName: 'MovieFiles' });
            Episode.belongsTo(Series);
            Series.hasMany(Episode);
            Episode.belongsToMany(File, { through: EpisodeFiles });
            File.belongsToMany(Episode, { through: EpisodeFiles });
            Movie.belongsToMany(File, { through: MovieFiles });
            File.belongsToMany(Movie, { through: MovieFiles });
            await sequelize.sync({ force: true });

            analyser = new MediaAnalyser({
                config: {
                    ffmpeg: { pathFFmpeg: null, pathFFprobe: null },
                    streaming: settings,
                    assets: { trickplayLocation: path.join(root, 'trickplay') }
                },
                queue: {
                    registerJob: (id: string, job: (attr: unknown) => Promise<void>) => jobs.set(id, job),
                    lowPriorityJob: (id: string, attr: unknown) => queued.push([id, attr])
                }
            } as unknown as Oblecto);
        });

        after(async () => {
            await sequelize.close();
            await fs.rm(root, { recursive: true, force: true });
        });

        it('finds the intro and credits a season shares, and makes seek thumbnails', async function () {
            if (!chromaprint) this.skip();

            const series = await Series.create({ seriesName: 'Show' });
            const files: File[] = [];

            for (const [number, coldOpen, story] of [[1, 20, 240], [2, 12, 250], [3, 31, 235]]) {
                const episode = await Episode.create({ SeriesId: series.id, airedSeason: '1', airedEpisodeNumber: String(number), episodeName: `E${number}` });
                const file = await File.create({ path: await makeEpisode(`e${number}.mp4`, number, coldOpen, story), host: 'local' });

                await EpisodeFiles.create({ EpisodeId: episode.id, FileId: file.id });
                files.push(file);
            }

            for (const file of files) analyser.queueFile(file);
            analyser.queueFile(files[0]);
            assert.equal(queued.length, 3, 'a file is queued once until it runs');

            await runQueued();

            const expected = [[20, 60, 300, 330], [12, 52, 302, 332], [31, 71, 306, 336]];

            for (const [i, file] of files.entries()) {
                await file.reload();
                const [introStart, introEnd, creditsStart, end] = expected[i];
                const intro = file.segments!.find(segment => segment.type === 'intro')!;
                const credits = file.segments!.find(segment => segment.type === 'credits')!;

                assert.deepEqual(file.chapters, []);
                assert.ok(Math.abs(file.duration! - end) < 0.2, `duration ${file.duration}`);
                assert.equal(intro.source, 'fingerprint');
                assert.ok(Math.abs(intro.start - introStart) < 1.5 && Math.abs(intro.end - introEnd) < 1.5, `episode ${i + 1} intro ${intro.start}-${intro.end}`);
                assert.ok(Math.abs(credits.start - creditsStart) < 1.5, `episode ${i + 1} credits ${credits.start}`);
                assert.equal(credits.end, file.duration);

                assert.equal(file.trickplay!.width, 320);
                assert.equal(file.trickplay!.height, 180);
                assert.equal(file.trickplay!.count, Math.ceil(end / 10));
                assert.equal(file.trickplay!.sheets, 1);
                assert.ok((await fs.stat(analyser.trickplaySheet(file, 0)!)).size > 1000);
                assert.equal(analyser.trickplaySheet(file, 1), null);
            }

            // Nothing left to do: a second pass queues the season but changes nothing
            const before = files.map(file => JSON.stringify(file.segments));
            for (const file of files) analyser.queueFile(file);
            await runQueued();
            for (const [i, file] of files.entries()) assert.equal(JSON.stringify((await file.reload()).segments), before[i]);
        });

        it('keeps segments set by hand, and looks again when they are reset', async function () {
            if (!chromaprint) this.skip();

            const file = (await File.findOne({ where: { path: path.join(root, 'e2.mp4') } }))!;

            await file.update({ segments: [{ type: 'recap', start: 0, end: 10, source: 'manual' }] });
            analyser.queueFile(file);
            await runQueued();
            assert.deepEqual((await file.reload()).segments, [{ type: 'recap', start: 0, end: 10, source: 'manual' }]);

            await analyser.resetSegments(file);
            await runQueued();
            assert.deepEqual((await file.reload()).segments!.map(segment => segment.type), ['intro', 'credits']);
        });

        it('waits for a second episode before deciding a lone episode has no intro', async function () {
            if (!chromaprint) this.skip();

            const series = await Series.create({ seriesName: 'New show' });
            const episode = await Episode.create({ SeriesId: series.id, airedSeason: '1', airedEpisodeNumber: '1', episodeName: 'Pilot' });
            const file = await File.create({ path: path.join(root, 'e1.mp4'), host: 'local' });

            await EpisodeFiles.create({ EpisodeId: episode.id, FileId: file.id });
            settings.trickplay = false;
            try {
                analyser.queueFile(file);
                await runQueued();
            } finally {
                settings.trickplay = true;
            }

            await file.reload();
            assert.deepEqual(file.chapters, []);
            assert.equal(file.segments, null);
            assert.equal(file.trickplay, null);
        });

        it('keeps manual corrections made while the file is being analysed', async () => {
            const binary = path.join(root, 'delayed-probe');
            const ready = path.join(root, 'delayed-probe-ready');
            const output = JSON.stringify({ format: { duration: '90' }, chapters: [{ start_time: '0', end_time: '20', tags: { title: 'Intro' } }] });
            await fs.writeFile(binary, `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(ready)}, 'ready'); setTimeout(() => process.stdout.write(${JSON.stringify(output)}), 300);\n`, { mode: 0o700 });
            const slow = new MediaAnalyser({
                config: { ffmpeg: { pathFFprobe: binary }, streaming: { trickplay: false }, assets: {} },
                queue: { registerJob: () => undefined }
            } as unknown as Oblecto);
            const movie = await Movie.create({ movieName: 'Corrected Film' });
            const file = await File.create({ path: '/not-read-by-the-stub', host: 'local', duration: 90 });
            await MovieFiles.create({ MovieId: movie.id, FileId: file.id });
            const work = slow.analyseFile(file.id);
            const deadline = Date.now() + 1000;
            while (!(await fs.stat(ready).catch(() => null))) {
                assert.ok(Date.now() < deadline, 'probe started');
                await delay(10);
            }
            const manual = [{ type: 'intro' as const, start: 5, end: 15, source: 'manual' as const }];
            await file.update({ segments: manual });
            await work;
            await file.reload();
            assert.deepEqual(file.segments, manual);
            assert.deepEqual(file.chapters, [{ start: 0, end: 20, title: 'Intro' }]);
            await slow.close();
        });

        it('takes a movie\'s segments from its chapter titles', async () => {
            const metadata = path.join(root, 'chapters.txt');
            const source = path.join(root, 'movie.mkv');

            await fs.writeFile(metadata, [
                ';FFMETADATA1',
                '[CHAPTER]', 'TIMEBASE=1/1000', 'START=0', 'END=15000', 'title=Opening Credits',
                '[CHAPTER]', 'TIMEBASE=1/1000', 'START=15000', 'END=50000', 'title=The Story',
                '[CHAPTER]', 'TIMEBASE=1/1000', 'START=50000', 'END=60000', 'title=End Credits',
                ''
            ].join('\n'));
            await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=5:duration=60', '-i', metadata, '-map_metadata', '1', '-map_chapters', '1', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', source]);

            const movie = await Movie.create({ movieName: 'Film' });
            const file = await File.create({ path: source, host: 'local' });

            await MovieFiles.create({ MovieId: movie.id, FileId: file.id });
            await analyser.analyseFile(file.id);
            await file.reload();

            assert.deepEqual(file.chapters, [
                { start: 0, end: 15, title: 'Opening Credits' },
                { start: 15, end: 50, title: 'The Story' },
                { start: 50, end: 60, title: 'End Credits' }
            ]);
            assert.deepEqual(file.segments, [
                { type: 'intro', start: 0, end: 15, source: 'chapters' },
                { type: 'credits', start: 50, end: 60, source: 'chapters' }
            ]);
            assert.equal(file.trickplay!.height, 240);
            assert.equal(file.trickplay!.count, 6);

            await analyser.removeFile(file.id);
            await assert.rejects(fs.stat(analyser.trickplayDirectory(file.id)));
        });
    });

    describe('in playback sessions', () => {
        let server: Server;
        let service: PlaybackService;
        let base: string;
        let root: string;
        const findFile = File.findByPk;
        const findUser = User.findByPk;
        const headers = { Authorization: `Bearer ${issueAccessToken({ id: 1, password: null }, config.authentication)}`, 'Content-Type': 'application/json' };

        before(async () => {
            root = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-markers-session-'));
            const analyser = new MediaAnalyser({
                config: { ffmpeg: {}, streaming: {}, assets: { trickplayLocation: root } },
                queue: { registerJob: () => undefined }
            } as unknown as Oblecto);

            await fs.mkdir(analyser.trickplayDirectory(1));
            await fs.writeFile(path.join(analyser.trickplayDirectory(1), '0.jpg'), 'sheet');

            service = new PlaybackService({ config: { ffmpeg: {}, streaming: {}, transcoding: {} }, mediaAnalyser: analyser } as unknown as Oblecto);
            service.probe = async () => ({ path: '/not-used.mp4', duration: 90, size: 100000, container: 'mp4', streams: [{ index: 0, codec_type: 'video', codec_name: 'h264' }, { index: 1, codec_type: 'audio', codec_name: 'aac' }] });
            User.findByPk = (async (id: number) => ({ id, password: null }) as User) as typeof User.findByPk;
            File.findByPk = (async (id: number) => id === 1
                ? {
                    id: 1,
                    path: '/not-used.mp4',
                    host: 'local',
                    extension: 'mp4',
                    chapters: [{ start: 0, end: 20, title: 'Intro' }, { start: 20, end: 90, title: null }],
                    segments: [{ type: 'intro', start: 0, end: 20, source: 'chapters' }],
                    trickplay: { width: 320, height: 180, tileWidth: 10, tileHeight: 10, interval: 10, count: 9, sheets: 1, bandwidth: 1000 }
                } as File
                : null) as typeof File.findByPk;

            const app = express();
            app.use(express.json());
            app.use((req: OblectoRequest, _res, next) => {
                if (req.headers.authorization) req.authorization = { scheme: 'Bearer', credentials: req.headers.authorization.split(' ')[1] };
                next();
            });
            streamingRoutes(app, { playback: service } as unknown as Oblecto);
            server = app.listen(0);
            await new Promise<void>(resolve => server.once('listening', resolve));
            base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
        });

        after(async () => {
            File.findByPk = findFile;
            User.findByPk = findUser;
            await service.close();
            await new Promise<void>(resolve => server.close(() => resolve()));
            await fs.rm(root, { recursive: true, force: true });
        });

        it('describe chapters, segments and thumbnail sheets, which any revision of the session serves', async () => {
            const session = await (await fetch(`${base}/playback/sessions`, { method: 'POST', headers, body: JSON.stringify({ fileId: 1 }) })).json();

            assert.deepEqual(session.chapters, [{ start: 0, end: 20, title: 'Intro' }, { start: 20, end: 90, title: null }]);
            assert.deepEqual(session.segments, [{ type: 'intro', start: 0, end: 20 }]);
            assert.equal(session.trickplay.count, 9);
            assert.equal(session.trickplay.sheets.length, 1);

            const sheet = await fetch(`${base}${session.trickplay.sheets[0]}`);

            assert.equal(sheet.status, 200);
            assert.equal(sheet.headers.get('content-type'), 'image/jpeg');
            assert.equal(await sheet.text(), 'sheet');
            assert.equal((await fetch(`${base}${session.trickplay.sheets[0].replace(/token=\w+/, 'token=wrong')}`)).status, 401);
            assert.equal((await fetch(`${base}${session.trickplay.sheets[0].replace('trickplay-0', 'trickplay-1')}`)).status, 404);

            await fetch(`${base}/playback/sessions/${session.sessionId}`, { method: 'PATCH', headers, body: JSON.stringify({ revision: 1, subtitleMode: 'off' }) });
            assert.equal((await fetch(`${base}${session.trickplay.sheets[0]}`)).status, 200);
        });
    });
});
