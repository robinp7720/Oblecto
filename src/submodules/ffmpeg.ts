import ffmpeg from 'fluent-ffmpeg';
import config from '../config.js';

if (Boolean(config.ffmpeg.pathFFprobe)) {
    ffmpeg.setFfprobePath(config.ffmpeg.pathFFprobe!);
}

if (Boolean(config.ffmpeg.pathFFmpeg)) {
    ffmpeg.setFfmpegPath(config.ffmpeg.pathFFmpeg!);
}

export default ffmpeg;
