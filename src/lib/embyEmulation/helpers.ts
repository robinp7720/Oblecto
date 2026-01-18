import path from 'path';

type MediaStream = {
    codec_type?: string;
    codec_name?: string;
    tags_language?: string;
    tags_title?: string;
    color_transfer?: string;
    color_primaries?: string;
    time_base?: string;
    codec_time_base?: string;
    color_range?: string;
    width?: number;
    height?: number;
    display_aspect_ratio?: string;
    pix_fmt?: string;
    level?: number;
    disposition_default?: number | boolean;
    index?: number;
};

type MediaFile = {
    id?: number | string;
    path?: string;
    name?: string;
    container?: string;
    extension?: string;
    duration?: number;
    size?: number;
    host?: string | null;
    hash?: string | null;
    Streams?: MediaStream[];
};

const normalizeBoolean = (value: unknown): boolean => value === true || value === 1;

const resolveDefaultStreamIndex = (streams: MediaStream[], codecType: string): number => {
    const matching = streams.filter((stream) => stream.codec_type === codecType);

    if (matching.length === 0) return -1;

    const defaultStream = matching.find((stream) => normalizeBoolean(stream.disposition_default));

    return (defaultStream || matching[0]).index ?? -1;
};

export const createStreamsList = (streams: MediaStream[]): Record<string, unknown>[] => {
    const mediaStreams: Record<string, unknown>[] = [];

    for (const stream of streams) {
        switch (stream.codec_type) {
            case 'video':
                mediaStreams.push({
                    'Codec': stream.codec_name,
                    'Language': stream.tags_language || 'eng',
                    'ColorTransfer': stream.color_transfer,
                    'ColorPrimaries': stream.color_primaries,
                    'TimeBase': stream.time_base,
                    'CodecTimeBase': stream.codec_time_base,
                    'VideoRange': stream.color_range,
                    'DisplayTitle': stream.tags_title || `${stream.width}p ${stream.codec_name} ${stream.color_range}`,
                    'NalLengthSize': '0',
                    'IsInterlaced': false,
                    'IsAVC': false,
                    'BitRate': 9253220,
                    'BitDepth': 8,
                    'RefFrames': 1,
                    'IsDefault': true,
                    'IsForced': false,
                    'Height': stream.height,
                    'Width': stream.width,
                    'AverageFrameRate': 23.976025,
                    'RealFrameRate': 23.976025,
                    'Profile': 'High',
                    'Type': 'Video',
                    'AspectRatio': stream.display_aspect_ratio,
                    'Index': stream.index,
                    'IsExternal': false,
                    'IsTextSubtitleStream': false,
                    'SupportsExternalStream': false,
                    'PixelFormat': stream.pix_fmt,
                    'Level': 40
                });
                break;
            case 'audio':
                mediaStreams.push({
                    'Codec': stream.codec_name,
                    'Language': stream.tags_language,
                    'TimeBase': stream.time_base,
                    'CodecTimeBase': stream.codec_time_base,
                    'Title': stream.tags_title || stream.tags_language,
                    'DisplayTitle': stream.tags_title || `${stream.tags_language} ${stream.codec_name}`,
                    'IsInterlaced': false,
                    'Channels': 6,
                    'SampleRate': 48000,
                    'IsDefault': true,
                    'IsForced': false,
                    'Type': 'Audio',
                    'Index': stream.index,
                    'IsExternal': false,
                    'IsTextSubtitleStream': false,
                    'SupportsExternalStream': false,
                    'Level': 0
                });
                break;
            case 'subtitle':
                mediaStreams.push({
                    'Codec': stream.codec_name,
                    'Language': stream.tags_language,
                    'TimeBase': stream.time_base,
                    'CodecTimeBase': stream.codec_time_base,
                    'Title': stream.tags_title || stream.tags_language,
                    'localizedUndefined': 'Undefined',
                    'localizedDefault': 'Default',
                    'localizedForced': 'Forced',
                    'DisplayTitle': stream.tags_title || stream.tags_language,
                    'IsInterlaced': false,
                    'IsDefault': false,
                    'IsForced': false,
                    'Type': 'Subtitle',
                    'Index': stream.index,
                    'IsExternal': false,
                    'IsTextSubtitleStream': true,
                    'SupportsExternalStream': true,
                    'Level': 0
                });
                break;
        }
    }

    return mediaStreams;
};

export const formatFileId = (value: unknown): string => {
    if (value === null || value === undefined) return '';

    const raw = String(value).trim();

    if (!raw) return '';

    const normalized = raw.replace(/-/g, '');

    if (/^\d+$/.test(raw)) {
        const numeric = Number(raw);

        if (Number.isFinite(numeric)) {
            return numeric.toString(16).padStart(32, '0');
        }
    }

    if (/^[0-9a-fA-F]{32}$/.test(normalized)) {
        return normalized.toLowerCase();
    }

    if (/^[0-9a-fA-F]+$/.test(normalized)) {
        return normalized.toLowerCase().padStart(32, '0');
    }

    return raw;
};

export const parseFileId = (value: unknown): number | string | null => {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') return value;

    const raw = String(value).trim();

    if (!raw) return null;

    const normalized = raw.replace(/-/g, '');

    if (/^[0-9a-fA-F]{32}$/.test(normalized)) {
        const parsed = parseInt(normalized, 16);

        return Number.isNaN(parsed) ? null : parsed;
    }

    if (/^\d+$/.test(raw)) {
        return parseInt(raw, 10);
    }

    return raw;
};

export const createMediaSources = (files: MediaFile[]): Record<string, unknown>[] => {
    if (!Array.isArray(files)) return [];

    return files.map((file) => {
        const streams = Array.isArray(file.Streams) ? file.Streams : [];
        const container = file.container
            || (file.extension ? file.extension.replace(/^\./, '') : '')
            || path.extname(file.path || '').replace('.', '')
            || 'mkv';
        const name = file.name
            || (file.path ? path.basename(file.path, path.extname(file.path)) : 'Unknown');
        const runtimeTicks = Number.isFinite(file.duration) ? (file.duration as number) * 10000000 : 0;
        const bitrate = Number.isFinite(file.size) && Number.isFinite(file.duration) && (file.duration as number) > 0
            ? Math.floor((file.size as number) / (file.duration as number))
            : 0;
        const defaultAudioStreamIndex = resolveDefaultStreamIndex(streams, 'audio');
        const defaultSubtitleStreamIndex = resolveDefaultStreamIndex(streams, 'subtitle');

        return {
            'Protocol': 'File',
            'Id': formatFileId(file.id),
            'Path': file.path,
            'Type': 'Default',
            'Container': container,
            'Size': file.size,
            'Name': name,
            'IsRemote': Boolean(file.host),
            'ETag': file.hash || `${file.id}`,
            'RunTimeTicks': runtimeTicks,
            'ReadAtNativeFramerate': false,
            'IgnoreDts': false,
            'IgnoreIndex': false,
            'GenPtsInput': false,
            'SupportsTranscoding': true,
            'SupportsDirectStream': true,
            'SupportsDirectPlay': true,
            'IsInfiniteStream': false,
            'UseMostCompatibleTranscodingProfile': false,
            'RequiresOpening': false,
            'RequiresClosing': false,
            'RequiresLooping': false,
            'SupportsProbing': true,
            'VideoType': 'VideoFile',
            'MediaStreams': createStreamsList(streams),
            'MediaAttachments': [],
            'Formats': [],
            'Bitrate': bitrate,
            'RequiredHttpHeaders': {},
            'TranscodingSubProtocol': 'http',
            'DefaultAudioStreamIndex': defaultAudioStreamIndex,
            'DefaultSubtitleStreamIndex': defaultSubtitleStreamIndex,
            'HasSegments': false
        };
    });
};

export const formatUuid = (id: number | string): string => {
    const hex = Number(id).toString(16).padStart(32, '0');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const parseUuid = (uuid: string): number => {
    return parseInt(uuid.replace(/-/g, ''), 16);
};

export const formatId = (id: number | string, type: string): string => {
    let prefix = '0';

    if (type === 'movie') prefix = '1';
    else if (type === 'series') prefix = '2';
    else if (type === 'episode') prefix = '3';
    else if (type === 'season') prefix = '4';
    else if (type === 'user') prefix = 'f';

    return prefix + Number(id).toString(16).padStart(31, '0');
};

export const parseId = (value: unknown): { id: number; type: string } => {
    if (value === null || value === undefined) {
        return { id: NaN, type: 'unknown' };
    }

    const raw = String(value).trim();

    if (!raw) {
        return { id: NaN, type: 'unknown' };
    }

    // Normalize early: remove dashes for UUID-formatted strings
    const normalized = raw.replace(/-/g, '');
    const lower = normalized.toLowerCase();

    const namedPrefixes = [
        { prefix: 'movie', type: 'movie' },
        { prefix: 'series', type: 'series' },
        { prefix: 'episode', type: 'episode' },
        { prefix: 'season', type: 'season' },
        { prefix: 'user', type: 'user' }
    ];

    for (const { prefix, type } of namedPrefixes) {
        if (lower.startsWith(prefix)) {
            const rest = normalized.slice(prefix.length);

            if (!rest) {
                return { id: NaN, type };
            }

            return {
                id: parseInt(rest, 16),
                type
            };
        }
    }

    const prefix = lower[0];
    const rest = normalized.slice(1);

    const type = prefix === '1' ? 'movie'
        : prefix === '2' ? 'series'
        : prefix === '3' ? 'episode'
        : prefix === '4' ? 'season'
        : prefix === 'f' ? 'user'
        : 'unknown';

    return {
        id: parseInt(rest, 16),
        type
    };
};
