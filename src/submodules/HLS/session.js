import uuid from 'node-uuid';
import databases from "../database";
import ffmpeg from "../ffmpeg";
import mkdirp from 'mkdirp';
import os from 'os';
import fs from 'fs';
import path from 'path'

export default class {
    maxGenCount = 8;
    timeOffset = 0;
    lastTime;

    constructor(fileId) {
        this.sessionId = uuid.v4();
        this.fileId = fileId;

        this.paused = true;
    }

    async init() {
        this.file = await databases.file.findByPk(this.fileId);

        mkdirp.sync(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}`);

        this.lastTime = new Date().getTime();
    }

    set offset(time) {
        if (this.remuxer) {
            return false;
        }

        return this.timeOffset = time
    }

    resetTimeout() {
        this.lastTime = new Date().getTime();
    }

    async start() {
        await this.init();

        this.remuxer = ffmpeg(this.file.path)
            .videoCodec('copy')
            .audioCodec('copy')
            .seekInput(this.timeOffset)
            .outputOptions([
                '-hls_time', '10',
                '-hls_list_size', '10',
                '-hls_playlist_type event',
                '-hls_base_url', `/HLS/${this.sessionId}/segment/`,
                '-hls_segment_filename', `${os.tmpdir()}/oblecto/sessions/${this.sessionId}/%03d.ts`,
            ])


            // setup event handlers

            // save to stream
            .on("start", (cmd) => {
                console.log("--- ffmpeg start process ---");
                console.log(`cmd: ${cmd}`);

                this.paused = false;
            })
            .on("end",() => {
                console.log("--- end processing ---");
            })
            .on("error", (err) => {
                console.log("--- ffmpeg meets error ---");
                console.log(err);
            })
            .save(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/index.m3u8`);

        this.segmentChecker =  setInterval(() => {
            // First check if the session has timed out. If it has, we don't really need to both with the deletion of
            // individual segments and just deleted the whole session.

            if ( new Date().getTime() - this.lastTime > 120000) {
                console.log('HLS Session', this.sessionId, 'has expired. Clearing now.');
                clearInterval(this.segmentChecker);
                this.clearSession();
                return
            }

            fs.readdir(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/`, (err, files) => {
                if (err) {
                    return false;
                }

                // This count will also include generated subtitle (.vtt) files and the stream index (.m3u8) files.
                // Not only the video segment (.ts) files.
                // However, to prevent oblecto from consuming all available ram, oblecto should pause the generation
                // of video segments if enough have been generated.
                // Generation will be resumed once non segment before the request segment has been requested.
                // This will then also cause the first segment in the sequence to be deleted from ram at it will most
                // likely not be needed anymore.

                const segments = files.filter(s => s.includes('.ts'));

                if (segments.length > this.maxGenCount) {
                    this.pauseSegmenting()
                } else {
                    this.resumeSegmenting()
                }
            });
        },1000)
    }

    clearSession() {
        this.remuxer.kill();

        fs.readdir(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/`, (err, files) => {
            if (err) {
                return false;
            }

            files.forEach((val, index) => {

                fs.unlink(`${os.tmpdir()}/oblecto/sessions/${this.sessionId}/${val}`, (err) => {
                    if (err) {
                        console.error(err);
                    }
                });
            })


        });

        delete this;
    }

    pauseSegmenting () {
        if (this.remuxer) {
            this.remuxer.kill('SIGSTOP');

            this.paused = true;

            return true
        }

        return false
    }

    resumeSegmenting () {
        if (this.remuxer) {
            this.remuxer.kill('SIGCONT');

            this.paused = false;

            return true;
        }

        return false;
    }
}