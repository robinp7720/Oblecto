import ffmpeg from './ffmpeg.js';
import { FfprobeData } from 'fluent-ffmpeg';

/**
 * Get information about a media file
 * @param path - File to probe
 * @returns - JSON object containing file information
 */
export default function ffprobe(path: string): Promise<FfprobeData> {
    return new Promise<FfprobeData>(function(resolve, reject) {
        ffmpeg.ffprobe(path, function (err, metadata) {
            if (err) {
                return reject(err);
            }

            return resolve(metadata);
        });
    });
}
