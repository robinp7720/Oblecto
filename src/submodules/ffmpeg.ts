import ffmpeg from 'fluent-ffmpeg';
import config from '../config.js';

if (config.ffmpeg.pathFFprobe) {
    ffmpeg.setFfprobePath(config.ffmpeg.pathFFprobe);
}

if (config.ffmpeg.pathFFmpeg) {
    ffmpeg.setFfmpegPath(config.ffmpeg.pathFFmpeg);
}

export default ffmpeg;
