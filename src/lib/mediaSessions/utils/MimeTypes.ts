/**
 * Get MIME type for a container format
 * @param format - The container format extension
 */
export function getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
        'mp4': 'video/mp4',
        'mpegts': 'video/mp2t',
        'ts': 'video/mp2t',
        'matroska': 'video/x-matroska',
        'mkv': 'video/x-matroska',
        'webm': 'video/webm',
        'avi': 'video/x-msvideo',
        'mov': 'video/quicktime',
        'flv': 'video/x-flv',
        'hls': 'application/x-mpegURL',
        'm3u8': 'application/x-mpegURL',
    };

    return mimeTypes[format.toLowerCase()] || 'video/mp4';
}

/**
 * Get MIME type for an audio format
 * @param format - The audio format extension
 */
export function getAudioMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'aac': 'audio/aac',
        'flac': 'audio/flac',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'opus': 'audio/opus',
        'm4a': 'audio/mp4',
    };

    return mimeTypes[format.toLowerCase()] || 'audio/mpeg';
}
