import ffmpeg from 'fluent-ffmpeg';

import config from '../config';

ffmpeg.setFfprobePath(config.ffmpeg.pathFFprobe);
ffmpeg.setFfmpegPath(config.ffmpeg.pathFFmpeg);

export default ffmpeg;