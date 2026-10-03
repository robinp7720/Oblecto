import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import MediaAnalyser from '../../src/lib/analysis/MediaAnalyser.js';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import express from 'express';
import { File } from '../../src/models/file.js';
import { Movie } from '../../src/models/movie.js';
import { User } from '../../src/models/user.js';
import { Group } from '../../src/models/group.js';
import config from '../../src/config.js';
import { issueAccessToken } from '../../src/lib/auth/tokens.js';
import { createChapters, createTrickplay, createMediaSources, formatId, formatFileId } from '../../src/lib/embyEmulation/helpers.js';
import mediaRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/media/index.js';
import fileRoutes from '../../src/submodules/REST/routes/files.js';
import { validateSettings } from '../../src/lib/settings/validation.js';
import type Oblecto from '../../src/lib/oblecto/index.js';
import type EmbyEmulation from '../../src/lib/embyEmulation/index.js';
import type { OblectoRequest } from '../../src/submodules/REST/index.js';

describe('Playback marker API contracts', () => {
    let server: Server;
    let base: string;
    let root: string;
    let admin = true;
    let resets = 0;
    const original = { file: File.findByPk, movie: Movie.findByPk, user: User.findByPk, group: Group.findByPk };
    const headers = { Authorization: `Bearer ${issueAccessToken({ id: 1, password: null }, config.authentication)}`, 'Content-Type': 'application/json' };
    const files = [1, 2].map(id => ({
        id, path: '/private/library/movie.mp4', host: 'local', duration: 95,
        chapters: [{ start: 0, end: 20, title: 'Opening' }],
        segments: [{ type: 'intro', start: 0, end: 20, source: 'chapters' }],
        trickplay: { width: 320, height: 180, tileWidth: 2, tileHeight: 2, interval: 10, count: 10, sheets: 3, bandwidth: 1000 },
        async update(values: object) { Object.assign(this, values); return this; }
    }));

    before(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'oblecto-marker-api-'));
        await fs.writeFile(path.join(root, '1.jpg'), 'first source');
        await fs.writeFile(path.join(root, '2.jpg'), 'second source');
        File.findByPk = (async (id: unknown) => files.find(file => file.id === Number(id)) ?? null) as typeof File.findByPk;
        Movie.findByPk = (async (id: unknown) => Number(id) === 10 ? { get: () => files } : null) as typeof Movie.findByPk;
        User.findByPk = (async () => ({ id: 1, password: null, groupId: 1 })) as typeof User.findByPk;
        Group.findByPk = (async () => ({ permissions: admin ? ['libraries.manage'] : [] })) as typeof Group.findByPk;
        const analyser = {
            trickplaySheet: (file: File, index: number) => Number.isSafeInteger(index) && index >= 0 && index < (file.trickplay?.sheets ?? 0) ? path.join(root, `${file.id}.jpg`) : null,
            resetSegments: async (file: File) => { resets++; await file.update({ segments: null }); }
        };
        const app = express();
        app.use(express.json());
        app.use((req: OblectoRequest, _res, next) => {
            if (req.headers.authorization) req.authorization = { scheme: 'Bearer', credentials: req.headers.authorization.split(' ')[1] };
            next();
        });
        fileRoutes(app, { mediaAnalyser: analyser } as unknown as Oblecto);
        // Production registers these routes behind the global Jellyfin session guard.
        mediaRoutes(app, { oblecto: { mediaAnalyser: analyser } } as unknown as EmbyEmulation);
        server = app.listen(0);
        await new Promise<void>(resolve => server.once('listening', resolve));
        base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    });

    after(async () => {
        File.findByPk = original.file;
        Movie.findByPk = original.movie;
        User.findByPk = original.user;
        Group.findByPk = original.group;
        await new Promise<void>(resolve => server.close(() => resolve()));
        await fs.rm(root, { recursive: true, force: true });
    });

    it('advertises chapters in ticks, thumbnails per source in milliseconds, and skippable sources', () => {
        assert.equal(createChapters(files[0])[0].StartPositionTicks, 0);
        assert.equal(createChapters(files[0])[0].Name, 'Opening');
        const manifest = createTrickplay(files)!;
        assert.equal((manifest[formatFileId(2)]['320'] as { Interval: number }).Interval, 10000);
        assert.equal(createMediaSources(files)[0].HasSegments, true);
    });

    it('resolves segment requests using the media-source IDs jellyfin-web supplies, with type filters', async () => {
        const response = await fetch(`${base}/mediasegments/${formatFileId(2)}?includeSegmentTypes=Intro`);
        const data = await response.json();
        assert.equal(data.TotalRecordCount, 1);
        assert.equal(data.Items[0].Type, 'Intro');
        assert.equal(data.Items[0].EndTicks, 200000000);
        assert.equal(data.Items[0].ItemId, formatFileId(2));
        const empty = await (await fetch(`${base}/mediasegments/${formatFileId(2)}?includeSegmentTypes=Outro`)).json();
        assert.equal(empty.TotalRecordCount, 0);
    });

    it('serves the selected source and rejects widths, sources and tile indexes it cannot serve', async () => {
        const prefix = `${base}/videos/${formatId(10, 'movie')}/trickplay`;
        const selected = await fetch(`${prefix}/320/0.jpg?MediaSourceId=${formatFileId(2)}`);
        assert.equal(selected.status, 200);
        assert.equal(await selected.text(), 'second source');
        for (const suffix of ['/321/0.jpg', '/320/3.jpg', '/320/-1.jpg', '/320/0.5.jpg', `/320/0.jpg?MediaSourceId=${formatFileId(99)}`]) {
            assert.equal((await fetch(prefix + suffix)).status, 404, suffix);
        }
        const playlist = await (await fetch(`${prefix}/320/tiles.m3u8?MediaSourceId=${formatFileId(2)}&ApiKey=token`)).text();
        assert.ok(playlist.includes('#EXT-X-TILES:RESOLUTION=320x180,LAYOUT=2x2,DURATION=10'));
        assert.ok(playlist.includes('#EXTINF:20,'), 'partial final sheet');
        assert.ok(playlist.includes(`2.jpg?MediaSourceId=${formatFileId(2)}&ApiKey=token`));
    });

    it('protects marker reads and manual writes, validates ranges, and resets detection on request', async () => {
        assert.equal((await fetch(`${base}/files/1/markers`)).status, 401);
        const response = await fetch(`${base}/files/1/markers`, { headers });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).path, undefined);
        admin = false;
        assert.equal((await fetch(`${base}/files/1/segments`, { method: 'PUT', headers, body: JSON.stringify({ segments: [] }) })).status, 403);
        admin = true;
        const invalid = await fetch(`${base}/files/1/segments`, { method: 'PUT', headers, body: JSON.stringify({ segments: [{ type: 'intro', start: 95.1, end: 95.5 }] }) });
        assert.equal(invalid.status, 400);
        const updated = await fetch(`${base}/files/1/segments`, { method: 'PUT', headers, body: JSON.stringify({ segments: [{ type: 'credits', start: 80, end: 95 }] }) });
        assert.equal(updated.status, 200);
        assert.deepEqual((await updated.json()).segments, [{ type: 'credits', start: 80, end: 95, source: 'manual' }]);
        assert.equal((await fetch(`${base}/files/1/segments`, { method: 'DELETE', headers })).status, 202);
        assert.equal(resets, 1);
        assert.equal(files[0].segments, null);
    });

    it('cancels and awaits an active probe during shutdown, and ignores queued work afterwards', async () => {
        const binary = path.join(root, 'slow-probe');
        const ready = path.join(root, 'probe-ready');
        await fs.writeFile(binary, `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(ready)}, 'ready'); setInterval(() => {}, 1000);\n`, { mode: 0o700 });
        const jobs = new Map<string, (value: number) => Promise<void>>();
        let queued = 0;
        const analyser = new MediaAnalyser({
            config: { ffmpeg: { pathFFprobe: binary }, streaming: { trickplay: false, detectSegments: false }, assets: {} },
            queue: {
                registerJob: (id: string, job: (value: number) => Promise<void>) => jobs.set(id, job),
                lowPriorityJob: () => { queued++; }
            }
        } as unknown as Oblecto);
        const previous = File.findByPk;
        File.findByPk = (async () => ({ id: 1, host: 'local', path: '/not-used', chapters: null })) as typeof File.findByPk;
        try {
            analyser.queueFile(1);
            const work = jobs.get('analyseFile')!(1);
            const rejected = assert.rejects(work, /Cancelled/);
            const deadline = Date.now() + 1000;
            while (!(await fs.stat(ready).catch(() => null))) {
                assert.ok(Date.now() < deadline, 'probe started');
                await delay(10);
            }
            await analyser.close();
            await rejected;
            analyser.queueFile(2);
            assert.equal(queued, 1);
            await jobs.get('analyseFile')!(2);
        } finally {
            await analyser.close();
            File.findByPk = previous;
        }
    });

    it('rejects invalid analysis configuration before persisting it', () => {
        assert.deepEqual(validateSettings({ streaming: { trickplay: false, detectSegments: true, trickplayInterval: 10 } }), {});
        for (const value of [0, 61, 1.5, '10']) assert.ok(validateSettings({ streaming: { trickplayInterval: value } })['streaming.trickplayInterval']);
        assert.ok(validateSettings({ streaming: { detectSegments: 'yes' } })['streaming.detectSegments']);
    });
});
