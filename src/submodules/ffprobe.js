import ffmpeg from './ffmpeg';

/**
 * Get information about a media file
 *
 * @param {string} path - File to probe
 * @returns {Promise<any>} - JSON object containing file information
 */
export default function ffprobe(path) {
    return ffmpeg.ffprobe(path);
}
