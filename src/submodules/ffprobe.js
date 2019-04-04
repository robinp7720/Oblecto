import ffmpeg from './ffmpeg';

export default function ffprobe(path) {
    return new Promise(function(resolve, reject) {
        ffmpeg.ffprobe(path, function (err, metadata) {
            if (err) {
                return reject(err);
            }

            return resolve(metadata);
        });
    });
}