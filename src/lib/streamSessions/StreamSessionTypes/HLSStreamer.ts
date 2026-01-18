import StreamSession, { StreamOptions, StreamDestination } from '../StreamSession.js';
import { mkdirp } from 'mkdirp';
import * as os from 'os';
import ffmpeg from '../../../submodules/ffmpeg.js';
import * as fs from 'fs';
import { promises as pfs } from 'fs';
import DirectHttpStreamSession from './DirectHttpStreamSession.js';

import type { File } from '../../../models/file.js';
import type Oblecto from '../../oblecto/index.js';

export default class HLSStreamer extends StreamSession {
    public maxGenCount: number;
    public segmentCheckerInterval?: NodeJS.Timeout;

    /**
     * @param file - File to be streamed
     * @param options - Options for Media streamer
     * @param oblecto - Oblecto server instance
     */
    constructor(file: File, options: StreamOptions, oblecto: Oblecto) {
        super(file, options, oblecto);

        this.timeoutTime = 10000;
        this.paused = true;
        this.maxGenCount = 10;

        if (this.targetVideoCodecs.includes(this.file.videoCodec ?? '')) {
            this.videoCodec = 'copy';
        }

        if (this.targetAudioCodecs.includes(this.file.audioCodec ?? '')) {
            this.audioCodec = 'copy';
        }

        this.startTimeout();

        // Create temporary directory to store HLS segments
        mkdirp.sync(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}`);

        this.process = ffmpeg(this.file.path as string)
            .videoCodec(this.getFfmpegVideoCodec())
            .audioCodec(this.audioCodec ?? 'aac')
            .seekInput(this.offset)
            .outputOptions([
                // '-hls_time 10',
                // '-hls_list_size 10',
                // '-hls_init_time 2',
                '-hls_playlist_type event',
                '-hls_base_url', `/HLS/${this.sessionId}/segment/`,
                '-hls_segment_filename', `${os.tmpdir()}/oblecto/sessions/${this.sessionId}/%03d.ts`,
            ]);

        this.process.on('start', cmd => this.segmenterStart(cmd));
        this.process.on('error', () => {});

        this.segmentCheckerInterval = setInterval(() => this.segmentChecker(), 100);

        this.startSegmenter();
    }

    async endSession(): Promise<void> {
        super.endSession();
        if (this.segmentCheckerInterval) {
            clearInterval(this.segmentCheckerInterval);
        }

        await pfs.rmdir(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/`, { recursive: true });
    }

    segmenterStart(cmd: string): void {
        void cmd;
        this.paused = false;
    }

    startSegmenter(): void {
        this.process?.save(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/index.m3u8`);
    }

    async segmentChecker(): Promise<void> {
        if (!this.process) return;

        const files = await pfs.readdir(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/`);

        const segments = files.filter(s => s.includes('.ts'));

        if (segments.length > this.maxGenCount) {
            this.pauseSegmenting();
        } else {
            this.resumeSegmenting();
        }
    }

    pauseSegmenting(): void {
        if (!this.process) return;
        if (this.paused) return;

        this.paused = true;

        this.process.kill('SIGSTOP');
    }

    resumeSegmenting(): void {
        if(!this.process) return;
        if (!this.paused) return;

        this.paused = false;

        this.process.kill('SIGCONT');
    }

    sendPlaylistFile(res: fs.WriteStream | NodeJS.WritableStream & { writeHead?: (code: number, headers: Record<string, string>) => void }): void {
        this.startTimeout();

        if ('writeHead' in res && typeof res.writeHead === 'function') {
            res.writeHead(200, { 'Content-Type': 'application/x-mpegURL' });
        }

        fs.createReadStream(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/index.m3u8`).pipe(res);
    }

    async streamSegment(req: unknown, res: unknown, segmentId: number): Promise<void> {
        this.clearTimeout();

        const response = res as NodeJS.WritableStream & { on: (event: 'close', cb: () => void) => void };

        response.on('close', () => {
            this.startTimeout();
        });

        DirectHttpStreamSession.httpStreamHandler(req as any, res as any, `${os.tmpdir()}/oblecto/sessions/${this.sessionId}/${('000' + segmentId).substr(-3)}.ts`);

        const files = await pfs.readdir(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/`);

        for (const file of files) {
            let sequenceId = file.replace('index', '')
                .replace('.vtt', '')
                .replace('.ts', '');

            sequenceId = parseInt(sequenceId, 10);

            if (segmentId > sequenceId) {
                await pfs.unlink(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/${file}`);
            }
        }
    }

    async addDestination(destination: StreamDestination): Promise<void> {
        this.destinations.push(destination);

        destination.stream.on('close', () => {
            for (const i in this.destinations) {
                if (this.destinations[i].stream === destination.stream) {
                    this.destinations.splice(Number(i), 1);
                }
            }
        });
    }

    async startStream(): Promise<void> {
        for (const { stream } of this.destinations) {
            this.sendPlaylistFile(stream as any);
        }
    }
}
