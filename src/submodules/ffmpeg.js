import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import stream from 'stream';

import config from '../config';

class FfmpegCommand extends EventEmitter {
    constructor(input) {
        super();
        this.input = input;
        this.formatValue = null;
        this.videoCodecValue = null;
        this.audioCodecValue = null;
        this.seekInputValue = null;
        this.inputOpts = [];
        this.outputOpts = [];
        this.process = null;
    }

    format(fmt) {
        this.formatValue = fmt;
        return this;
    }

    videoCodec(codec) {
        this.videoCodecValue = codec;
        return this;
    }

    audioCodec(codec) {
        this.audioCodecValue = codec;
        return this;
    }

    seekInput(offset) {
        this.seekInputValue = offset;
        return this;
    }

    _parseOptions(options) {
        if (!Array.isArray(options)) {
            options = [options];
        }

        const result = [];

        for (const opt of options) {
            if (typeof opt === 'string') {
                const matches = opt.match(/(?:[^\s"]+|"[^"]*")+/g);
                if (matches) {
                    result.push(...matches);
                }
            } else {
                result.push(String(opt));
            }
        }

        return result;
    }

    inputOptions(options) {
        this.inputOpts.push(...this._parseOptions(options));
        return this;
    }

    outputOptions(options) {
        this.outputOpts.push(...this._parseOptions(options));
        return this;
    }

    _buildArgs() {
        const args = [];
        if (this.seekInputValue !== null) {
            args.push('-ss', String(this.seekInputValue));
        }

        if (this.input instanceof stream.Stream) {
            args.push('-i', 'pipe:0');
        } else {
            args.push('-i', this.input);
        }

        args.push(...this.inputOpts);

        if (this.videoCodecValue) {
            args.push('-vcodec', this.videoCodecValue);
        }

        if (this.audioCodecValue) {
            args.push('-acodec', this.audioCodecValue);
        }

        args.push(...this.outputOpts);

        if (this.formatValue) {
            args.push('-f', this.formatValue);
        }

        return args;
    }

    _spawn(extraArgs, stdio) {
        const ffmpegPath = config.ffmpeg.pathFFmpeg || 'ffmpeg';
        const args = [...this._buildArgs(), ...extraArgs];
        const child = spawn(ffmpegPath, args, { stdio });

        this.process = child;
        this.emit('start', `${ffmpegPath} ${args.join(' ')}`);

        // Drain stderr to avoid blocking if ffmpeg writes extensive logs
        if (child.stderr) {
            child.stderr.on('data', (data) => this.emit('stderr', data.toString()));
        }

        child.on('close', (code, signal) => this.emit('end', code, signal));
        child.on('error', (err) => this.emit('error', err));

        return child;
    }

    pipe(outStream, options = {}) {
        const child = this._spawn(['pipe:1'], ['pipe', 'pipe', 'pipe']);

        if (this.input instanceof stream.Stream) {
            this.input.pipe(child.stdin);
        }

        child.stdout.pipe(outStream, { end: options.end });
        return this;
    }

    save(path) {
        const child = this._spawn([path], ['pipe', 'pipe', 'pipe']);

        if (this.input instanceof stream.Stream) {
            this.input.pipe(child.stdin);
        }

        return this;
    }

    kill(signal) {
        if (this.process) {
            this.process.kill(signal);
        }
    }
}

function ffmpeg(input) {
    return new FfmpegCommand(input);
}

ffmpeg.ffprobe = function ffprobe(path, cb) {
    const promise = new Promise((resolve, reject) => {
        const ffprobePath = config.ffmpeg.pathFFprobe || 'ffprobe';
        const args = [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            path,
        ];

        const child = spawn(ffprobePath, args);
        let data = '';

        child.stdout.on('data', chunk => {
            data += chunk;
        });

        child.on('error', err => reject(err));

        child.on('close', (code) => {
            if (code === 0) {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    reject(err);
                }
            } else {
                reject(new Error(`ffprobe exited with code ${code}`));
            }
        });
    });

    if (cb) {
        promise.then((data) => cb(null, data)).catch((err) => cb(err));
    } else {
        return promise;
    }
};

export default ffmpeg;
