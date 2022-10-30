import StreamSession from '../StreamSession';
import mkdirp from 'mkdirp';
import * as os from 'os';
import ffmpeg from '../../../submodules/ffmpeg';
import * as fs from 'fs';
import { promises as pfs } from 'fs';
import DirectHttpStreamSession from './DirectHttpStreamSession';

/**
 * @typedef {import('../../oblecto').default} Oblecto
 * @typedef {import("../../../models/file").File} File
 */

export default class HLSStreamer extends StreamSession {
    /**
     * @param {File} file - File to be streamed
     * @param {any} options - Options for Media streamer
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(file, options, oblecto) {
        super(file, options, oblecto);

        this.timeoutTime = 10000;
        this.paused = true;
        this.maxGenCount = 10;

        if (this.videoCodec === this.file.videoCodec in this.targetVideoCodecs) {
            this.videoCodec = 'copy';
        }

        if (this.audioCodec === this.file.audioCodec in this.targetAudioCodecs) {
            this.audioCodec = 'copy';
        }

        this.startTimeout();

        // Create temporary directory to store HLS segments
        mkdirp.sync(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}`);

        this.process = ffmpeg(this.file.path)
            .videoCodec(this.getFfmpegVideoCodec())
            .audioCodec(this.audioCodec)
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
        this.process.on('error', err => {});

        this.segmentCheckerInterval = setInterval(() => this.segmentChecker(), 100);

        this.startSegmenter();
    }

    async endSession() {
        super.endSession();
        clearInterval(this.segmentCheckerInterval);

        await pfs.rmdir(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/`, { recursive: true });
    }

    segmenterStart(cmd) {
        this.paused = false;
    }

    startSegmenter() {
        this.process.save(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/index.m3u8`);
    }

    async segmentChecker() {
        if (!this.process) return;

        let files = await pfs.readdir(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/`);

        const segments = files.filter(s => s.includes('.ts'));

        if (segments.length > this.maxGenCount) {
            this.pauseSegmenting();
        } else {
            this.resumeSegmenting();
        }
    }

    pauseSegmenting() {
        if (!this.process) return;
        if (this.paused) return;

        this.paused = true;

        this.process.kill('SIGSTOP');
    }

    resumeSegmenting() {
        if(!this.process) return;
        if (!this.paused) return;

        this.paused = false;

        this.process.kill('SIGCONT');
    }

    sendPlaylistFile(res) {
        this.startTimeout();

        res.writeHead(200, { 'Content-Type': 'application/x-mpegURL' });

        fs.createReadStream(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/index.m3u8`).pipe(res);
    }

    async streamSegment(req, res, segmentId) {
        this.clearTimeout();

        res.on('close', () => {
            this.startTimeout();
        });

        DirectHttpStreamSession.httpStreamHandler(req, res, `${os.tmpdir()}/oblecto/sessions/${this.sessionId}/${('000' + segmentId).substr(-3)}.ts`);

        let files = await pfs.readdir(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/`);

        for (let file of files) {
            let sequenceId = file.replace('index', '')
                .replace('.vtt', '')
                .replace('.ts', '');

            sequenceId = parseInt(sequenceId);

            if (segmentId > sequenceId) {
                await pfs.unlink(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/${file}`);
            }
        }
    }

    async addDestination(destination) {
        this.destinations.push(destination);

        destination.stream.on('close', () => {
            for (let i in this.destinations) {
                if (this.destinations[i].stream === destination.stream) {
                    this.destinations.splice(i, 1);
                }
            }
        });
    }

    async startStream() {
        for (let { stream } of this.destinations) {
            this.sendPlaylistFile(stream);
        }
    }
}
