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

const firstNonEmpty = (...args: (string | undefined | null)[]): string => {
    return args.find(arg => arg !== null && arg !== undefined && arg.length > 0) || '';
};

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

    let raw = '';
    if (typeof value === 'string') raw = value.trim();
    else if (typeof value === 'number' || typeof value === 'boolean') raw = String(value);

    if (!raw) return '';

    // The original code had an unreachable `return ''` here, which is now removed.
    // The next `if (!raw) return '';` is redundant but kept as per instruction to only apply the specific change.
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
    let raw: string | null = null;

    if (typeof value === 'string') raw = value.trim();
    else if (typeof value === 'number') return value;
    else if (typeof value === 'boolean') raw = String(value);

    if (!raw) return null;

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

    let raw = '';
    if (typeof value === 'string') raw = value.trim();
    else if (typeof value === 'number' || typeof value === 'boolean') raw = String(value);

    if (!raw) {
        return { id: NaN, type: 'unknown' };
    }

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

export type MediaItem = {
    id: number | string;
    movieName?: string | null;
    seasonName?: string | null;
    episodeName?: string | null;
    seriesName?: string | null;
    releaseDate?: string | null;
    firstAired?: string | null;
    rating?: string | null;
    popularity?: number | null;
    runtime?: number | null;
    overview?: string | null;
    airedSeason?: string | number | null;
    airedEpisodeNumber?: string | number | null;
    Series?: { id: number; seriesName?: string | null };
    SeriesId?: number;
    indexNumber?: string | number;
    Files?: MediaFile[];
    TrackMovies?: Array<{ time?: number; progress?: number; updatedAt?: Date }>;
    TrackEpisodes?: Array<{ time?: number; progress?: number; updatedAt?: Date }>;
    name?: string | null;
};

type EmbyEmulationLike = {
    serverId: string;
};

export const formatMediaItem = (item: MediaItem, type: string, embyEmulation: EmbyEmulationLike): Record<string, unknown> => {
    const id = formatId(item.id, type);

    const res: Record<string, unknown> = {
        'Name': firstNonEmpty(item.movieName, item.seasonName, item.episodeName, item.seriesName),
        'ServerId': embyEmulation.serverId,
        'Id': id,
        'HasSubtitles': true,
        'Container': 'mkv',
        'PremiereDate': firstNonEmpty(item.releaseDate, item.firstAired) || undefined,
        'CriticRating': 82,
        'OfficialRating': item.rating || 'PG-13',
        'CommunityRating': item.popularity ?? 2.6,
        'RunTimeTicks': (item.runtime || 0) * 60 * 10000000,
        'ProductionYear': firstNonEmpty(item.releaseDate, item.firstAired).substring(0, 4),
        'IsFolder': type === 'series' || type === 'season',
        'Type': type.charAt(0).toUpperCase() + type.slice(1),
        'PrimaryImageAspectRatio': 0.6666666666666666,
        'VideoType': 'VideoFile',
        'LocationType': 'FileSystem',
        'MediaType': 'Video',
        'Overview': item.overview,
        'UserData': {
            'PlaybackPositionTicks': 0,
            'PlayCount': 0,
            'IsFavorite': false,
            'Played': false,
            'Key': item.id.toString(),
            'ItemId': id
        },
        'ImageTags': { 'Primary': 'primary' },
        'BackdropImageTags': ['backdrop'],
        'ImageBlurHashes': {
            'Primary': { 'primary': 'WZE2te~q.8?b-;-;-p%2t8tQt6W.s.sSayNaR%NGxtt7t7t7X8oz' },
            'Backdrop': { 'backdrop': 'WeEx-RE0IUxuR*%1~WE1M{t7S1t7-;IoRjt7bbae-pRjRQt7ofRj' }
        }
    };

    if (type === 'episode') {
        const seriesId = item.Series ? item.Series.id : item.SeriesId;
        const seasonNumber = parseInt(String(item.airedSeason ?? '0'), 10);

        res.IndexNumber = parseInt(String(item.airedEpisodeNumber ?? '0'), 10);
        res.ParentIndexNumber = seasonNumber;
        res.SeriesName = item.Series?.seriesName ?? '';
        res.SeriesId = seriesId ? formatId(seriesId, 'series') : '';
        res.SeasonName = 'Season ' + item.airedSeason;
        res.PrimaryImageAspectRatio = 1.7777777777777777;
        res.ImageTags = { ...(res.ImageTags as Record<string, string>), Thumb: 'thumb' };

        if (seriesId && Number.isFinite(seasonNumber)) {
            const seasonId = (seriesId * 1000) + seasonNumber;

            res.SeasonId = formatId(seasonId, 'season');
            res.ParentId = res.SeasonId;
        }
    }

    if (type === 'season') {
        res.SeriesId = item.SeriesId ? formatId(item.SeriesId, 'series') : '';
        res.SeasonName = item.seasonName;
        res.IndexNumber = parseInt(String(item.indexNumber ?? '0'), 10);
        res.ParentId = res.SeriesId;
        res.SeriesName = item.seriesName;
    }

    if (item.Files && item.Files.length > 0) {
        res.Path = item.Files[0].path;
        res.Container = item.Files[0].container || res.Container;
        if (Number.isFinite(item.Files[0].duration)) {
            res.RunTimeTicks = (item.Files[0].duration as number) * 10000000;
        }
        res.MediaSources = createMediaSources(item.Files);
    }

    const track = item.TrackMovies?.[0] || item.TrackEpisodes?.[0];

    if (track) {
        const userData = res.UserData as Record<string, unknown>;
        userData.PlaybackPositionTicks = (track.time ?? 0) * 10000000;
        userData.Played = (track.progress ?? 0) >= 1;
        userData.PlayCount = userData.Played ? 1 : 0;
        if (track.updatedAt) {
            userData.LastPlayedDate = track.updatedAt.toISOString();
        }
    }

    return res;
};

export const toSearchHint = (item: MediaItem, type: string): Record<string, unknown> => {
    const id = formatId(item.id, type);
    const name = firstNonEmpty(item.movieName, item.seasonName, item.episodeName, item.seriesName, item.name);

    return {
        'ItemId': id,
        'Id': id,
        'Name': name,
        'MatchedTerm': name,
        'Type': type.charAt(0).toUpperCase() + type.slice(1),
        'MediaType': 'Video',
        'ProductionYear': (firstNonEmpty(item.releaseDate, item.firstAired) || '').substring(0, 4),
        'RunTimeTicks': (item.runtime || 0) * 10000000,
        'PrimaryImageAspectRatio': 0.6666666666666666,
        'IndexNumber': item.indexNumber,
    };
};
