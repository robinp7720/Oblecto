export type Track = {
    index: number;
    codec_type: string;
    codec_name?: string;
    profile?: string;
    width?: number;
    height?: number;
    level?: number;
    pix_fmt?: string;
    channels?: number;
    color_transfer?: string;
    avg_frame_rate?: string;
    tags?: { language?: string; title?: string };
    disposition?: { default?: number; forced?: number; attached_pic?: number };
};
export type Media = {
    path: string;
    duration: number;
    container: string;
    streams: Track[];
    size: number;
};
export type Capabilities = {
    containers?: string[];
    videoCodecs?: string[];
    audioCodecs?: string[];
    profiles?: string[];
    maxLevel?: number;
    maxBitDepth?: number;
    maxAudioChannels?: number;
    maxHeight?: number;
    hdr?: boolean;
    nativeTracks?: boolean;
    hls?: boolean;
};
export type PlaybackOptions = {
    capabilities?: Capabilities;
    position?: number;
    audioStreamIndex?: number | null;
    subtitleStreamIndex?: number | null;
    subtitleMode?: 'off' | 'auto' | 'forced';
    quality?: 'original' | 'auto' | number;
    maxBitrate?: number;
    forceHls?: boolean;
};
export type Rendition = { id: string; height: number; bitrate: number };
export type PlaybackPlan = {
    method: 'direct' | 'remux' | 'transcode';
    reason: string;
    audio: Track | null;
    subtitle: Track | null;
    video: Track | null;
    burnSubtitles: boolean;
    hdr: boolean;
    renditions: Rendition[];
    boundaries: number[];
};
export class PlaybackError extends Error {
    constructor(
        public code: string,
        message: string,
        public statusCode = 400
    ) {
        super(message);
    }
}
export const invalid = (message: string): never => {
    throw new PlaybackError('INVALID_SELECTION', message);
};
export function validateOptions(input: PlaybackOptions): PlaybackOptions {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        invalid('Expected playback options');
    for (const field of ['position', 'maxBitrate'] as const) {
        const value = input[field];
        if (
            value !== undefined &&
            (!Number.isFinite(value) ||
                value < 0 ||
                (field === 'maxBitrate' && value < 200000))
        )
            invalid(`Invalid ${field}`);
    }
    for (const field of ['audioStreamIndex', 'subtitleStreamIndex'] as const) {
        const value = input[field];
        if (
            value !== undefined &&
            value !== null &&
            (!Number.isSafeInteger(value) || value < 0)
        )
            invalid(`Invalid ${field}`);
    }
    if (
        input.subtitleMode !== undefined &&
        !['off', 'auto', 'forced'].includes(input.subtitleMode)
    )
        invalid('Invalid subtitleMode');
    if (
        input.quality !== undefined &&
        !['original', 'auto', 360, 480, 720, 1080].includes(input.quality)
    )
        invalid('Invalid quality');
    if (input.forceHls !== undefined && typeof input.forceHls !== 'boolean')
        invalid('Invalid forceHls');
    const c = input.capabilities;
    if (c !== undefined) {
        if (!c || typeof c !== 'object' || Array.isArray(c))
            invalid('Invalid capabilities');
        for (const key of [
            'containers',
            'videoCodecs',
            'audioCodecs',
            'profiles'
        ] as const) {
            if (
                c[key] !== undefined &&
                (!Array.isArray(c[key]) ||
                    c[key].length > 64 ||
                    c[key].some((v) => typeof v !== 'string' || v.length > 80))
            )
                invalid(`Invalid ${key}`);
        }
        for (const key of [
            'maxLevel',
            'maxBitDepth',
            'maxAudioChannels',
            'maxHeight'
        ] as const) {
            if (
                c[key] !== undefined &&
                (!Number.isFinite(c[key]) || c[key] <= 0)
            )
                invalid(`Invalid ${key}`);
        }
        for (const key of ['hdr', 'hls', 'nativeTracks'] as const) {
            if (c[key] !== undefined && typeof c[key] !== 'boolean')
                invalid(`Invalid ${key}`);
        }
    }
    return input;
}
