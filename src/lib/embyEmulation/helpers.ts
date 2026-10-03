import path from 'path';
import { createHash } from 'node:crypto';
import { WATCHED_PROGRESS } from '../playback/progress.js';
import { genresFrom } from '../common/genres.js';

type MediaStream = {
    profile?: string;
    bit_rate?: number | string;
    bits_per_raw_sample?: number | string;
    channels?: number;
    sample_rate?: number | string;
    disposition_forced?: number | boolean;
    avg_frame_rate?: string;
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
    chapters?: unknown;
    segments?: unknown;
    trickplay?: unknown;
};

type FileChapter = { start: number; end: number; title: string | null };
type FileTrickplay = { width: number; height: number; tileWidth: number; tileHeight: number; interval: number; count: number; bandwidth: number };

// The JSON columns arrive parsed from a model, but as text from a raw query
const fromJson = <T>(value: unknown): T | null => {
    if (typeof value !== 'string') return (value ?? null) as T | null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
};

const TICKS_PER_SECOND = 10000000;

/** A file's chapters as Jellyfin ChapterInfo. Oblecto makes no chapter images. */
export const createChapters = (file: MediaFile | undefined): Record<string, unknown>[] =>
    (fromJson<FileChapter[]>(file?.chapters) ?? []).map(chapter => ({
        'StartPositionTicks': Math.round(chapter.start * TICKS_PER_SECOND),
        'Name': chapter.title ?? '',
        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
    }));

/** Seek thumbnails per media source and width, as Jellyfin's BaseItemDto.Trickplay. */
export const createTrickplay = (files: MediaFile[]): Record<string, Record<string, unknown>> | undefined => {
    const result: Record<string, Record<string, unknown>> = {};

    for (const file of files) {
        const info = fromJson<FileTrickplay>(file.trickplay);

        if (!info) continue;
        result[formatFileId(file.id)] = {
            [String(info.width)]: {
                'Width': info.width,
                'Height': info.height,
                'TileWidth': info.tileWidth,
                'TileHeight': info.tileHeight,
                'ThumbnailCount': info.count,
                'Interval': info.interval * 1000,
                'Bandwidth': info.bandwidth
            }
        };
    }

    return Object.keys(result).length ? result : undefined;
};

/** Whether a file has intros, credits or other segments to skip. */
export const fileHasSegments = (file: MediaFile | undefined): boolean => (fromJson<unknown[]>(file?.segments) ?? []).length > 0;

const normalizeBoolean = (value: unknown): boolean => value === true || value === 1;

const firstNonEmpty = (...args: (string | undefined | null)[]): string => {
    return args.find(arg => arg !== null && arg !== undefined && arg.length > 0) || '';
};

const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);

const resolveDefaultStreamIndex = (streams: MediaStream[], codecType: string): number => {
    const matching = streams.filter((stream) => stream.codec_type === codecType);

    if (matching.length === 0) return -1;

    const defaultStream = matching.find((stream) => normalizeBoolean(stream.disposition_default));

    return (defaultStream || matching[0]).index ?? -1;
};

const frameRate = (value?: string): number | undefined => {
    const [numerator, denominator = '1'] = (value ?? '').split('/');
    const result = Number(numerator) / Number(denominator);
    return Number.isFinite(result) && result > 0 ? result : undefined;
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
                    'BitRate': Number(stream.bit_rate) || undefined,
                    'BitDepth': Number(stream.bits_per_raw_sample) || 8,
                    'RefFrames': 1,
                    'IsDefault': normalizeBoolean(stream.disposition_default),
                    'IsForced': normalizeBoolean(stream.disposition_forced),
                    'Height': stream.height,
                    'Width': stream.width,
                    'AverageFrameRate': frameRate(stream.avg_frame_rate),
                    'RealFrameRate': frameRate(stream.avg_frame_rate),
                    'Profile': stream.profile,
                    'Type': 'Video',
                    'AspectRatio': stream.display_aspect_ratio,
                    'Index': stream.index,
                    'IsExternal': false,
                    'IsTextSubtitleStream': false,
                    'SupportsExternalStream': false,
                    'PixelFormat': stream.pix_fmt,
                    'Level': stream.level
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
                    'Channels': stream.channels,
                    'SampleRate': Number(stream.sample_rate) || undefined,
                    'IsDefault': normalizeBoolean(stream.disposition_default),
                    'IsForced': normalizeBoolean(stream.disposition_forced),
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
                    'IsDefault': normalizeBoolean(stream.disposition_default),
                    'IsForced': normalizeBoolean(stream.disposition_forced),
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

    if (raw === '') return '';

    const normalized = raw.replace(/-/g, '');

    if (/^\d+$/.test(raw)) {
        return BigInt(raw).toString(16).padStart(32, '0');
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

    if (raw === null || raw === '') return null;

    const normalized = raw.replace(/-/g, '');

    if (/^[0-9a-fA-F]{32}$/.test(normalized)) {
        const parsed = BigInt(`0x${normalized}`);

        return parsed <= maxSafeInteger
            ? Number(parsed)
            : parsed.toString(10);
    }

    if (/^\d+$/.test(raw)) {
        const parsed = BigInt(raw);

        return parsed <= maxSafeInteger
            ? Number(parsed)
            : raw;
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
            ? Math.floor((file.size as number) * 8 / (file.duration as number))
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
            'IsRemote': Boolean(file.host && file.host !== 'local'),
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
            'HasSegments': fileHasSegments(file)
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
    else if (type === 'person') prefix = '5';
    else if (type === 'boxset') prefix = '6';
    else if (type === 'seriesset') prefix = '8';
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

    const ID_TYPES: Record<string, string> = {
        '1': 'movie',
        '2': 'series',
        '3': 'episode',
        '4': 'season',
        '5': 'person',
        '6': 'boxset',
        '7': 'genre',
        '8': 'seriesset',
        'f': 'user'
    };
    const type = ID_TYPES[prefix] ?? 'unknown';

    return {
        id: parseInt(rest, 16),
        type
    };
};

export type MediaItem = {
    id: number | string;
    movieName?: string | null;
    originalName?: string | null;
    tagline?: string | null;
    genres?: string | null;
    genre?: string | null;
    seasonName?: string | null;
    episodeName?: string | null;
    seriesName?: string | null;
    releaseDate?: string | null;
    firstAired?: string | null;
    rating?: string | null;
    siteRating?: number | null;
    runtime?: number | null;
    overview?: string | null;
    status?: string | null;
    network?: string | null;
    airsDayOfWeek?: string | null;
    airsTime?: string | null;
    tmdbid?: number | null;
    imdbid?: string | null;
    tvdbid?: number | null;
    airedSeason?: string | number | null;
    airedEpisodeNumber?: string | number | null;
    Series?: { id: number; seriesName?: string | null };
    SeriesId?: number;
    indexNumber?: string | number;
    Files?: MediaFile[];
    TrackMovies?: Array<{ time?: number | null; progress?: number | null; updatedAt?: Date }>;
    TrackEpisodes?: Array<{ time?: number | null; progress?: number | null; updatedAt?: Date }>;
    name?: string | null;
    createdAt?: Date | string | null;
};

type EmbyEmulationLike = {
    serverId: string;
};

const JELLYFIN_TYPE: Record<string, string> = {
    movie: 'Movie',
    series: 'Series',
    season: 'Season',
    episode: 'Episode'
};

const isoDate = (value: Date | string | null | undefined): string | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const date = value instanceof Date ? value : new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const yearOf = (value: string): number | undefined => {
    const year = parseInt(value.substring(0, 4), 10);

    return Number.isFinite(year) ? year : undefined;
};

/** A stable id for a genre, which Jellyfin treats as an item of its own. */
export const genreId = (name: string): string => '7' + createHash('sha256').update(name.toLowerCase()).digest('hex').slice(0, 31);

/** The ids other services know an item by, and links to it there. */
const providerIds = (item: MediaItem, type: string): { ProviderIds: Record<string, string>; ExternalUrls: Array<{ Name: string; Url: string }> } => {
    const ids: Record<string, string> = {};
    const urls: Array<{ Name: string; Url: string }> = [];

    if (item.tmdbid) {
        ids.Tmdb = String(item.tmdbid);
        if (type === 'movie' || type === 'series') urls.push({ Name: 'TheMovieDb', Url: `https://www.themoviedb.org/${type === 'movie' ? 'movie' : 'tv'}/${item.tmdbid}` });
    }
    if (item.imdbid) {
        ids.Imdb = item.imdbid;
        urls.push({ Name: 'IMDb', Url: `https://www.imdb.com/title/${item.imdbid}` });
    }
    if (item.tvdbid) ids.Tvdb = String(item.tvdbid);

    return { ProviderIds: ids, ExternalUrls: urls };
};

/**
 * Describe a movie, series, season or episode as a Jellyfin BaseItemDto. Only what Oblecto knows:
 * a rating, genre or tagline it does not have is left out rather than made up.
 */
export const formatMediaItem = (item: MediaItem, type: string, embyEmulation: EmbyEmulationLike): Record<string, unknown> => {
    const id = formatId(item.id, type);
    const name = firstNonEmpty(item.movieName, item.seasonName, item.episodeName, item.seriesName);
    const premiere = firstNonEmpty(item.releaseDate, item.firstAired);
    const genres = genresFrom(item.genres ?? item.genre);
    const playable = type === 'movie' || type === 'episode';

    const res: Record<string, unknown> = {
        'Name': name,
        'SortName': name.toLowerCase(),
        'ServerId': embyEmulation.serverId,
        'Id': id,
        'Etag': id,
        'DateCreated': isoDate(item.createdAt),
        'PremiereDate': isoDate(premiere),
        'OfficialRating': item.rating || undefined,
        'CommunityRating': typeof item.siteRating === 'number' && item.siteRating > 0 ? Math.round(item.siteRating * 10) / 10 : undefined,
        'RunTimeTicks': item.runtime ? item.runtime * 60 * 10000000 : undefined,
        'ProductionYear': yearOf(premiere),
        'IsFolder': !playable,
        'Type': JELLYFIN_TYPE[type] ?? type.charAt(0).toUpperCase() + type.slice(1),
        'PrimaryImageAspectRatio': 0.6666666666666666,
        'LocationType': 'FileSystem',
        'MediaType': playable ? 'Video' : 'Unknown',
        'Overview': item.overview ?? undefined,
        'Genres': genres,
        'GenreItems': genres.map(genre => ({ Name: genre, Id: genreId(genre) })),
        'Taglines': item.tagline ? [item.tagline] : [],
        'Tags': [],
        'People': [],
        'Studios': item.network ? [{ Name: item.network, Id: genreId(`studio:${item.network}`) }] : [],
        'LockedFields': [],
        'LockData': false,
        'CanDelete': false,
        'CanDownload': false,
        'PlayAccess': 'Full',
        ...providerIds(item, type),
        'UserData': {
            'PlaybackPositionTicks': 0,
            'PlayCount': 0,
            'IsFavorite': false,
            'Played': false,
            'Key': id,
            'ItemId': id
        },
        'ImageTags': { 'Primary': 'primary' },
        'BackdropImageTags': ['backdrop']
    };

    if (playable) res.VideoType = 'VideoFile';

    if (type === 'movie' && item.originalName && item.originalName !== item.movieName) res.OriginalTitle = item.originalName;

    if (type === 'series') {
        res.Status = item.status || undefined;
        res.AirDays = item.airsDayOfWeek ? [item.airsDayOfWeek] : [];
        res.AirTime = item.airsTime || undefined;
        res.DisplayOrder = 'Aired';
    }

    if (type === 'episode') {
        const seriesId = item.Series ? item.Series.id : item.SeriesId;
        const seasonNumber = parseInt(String(item.airedSeason ?? '0'), 10);

        res.IndexNumber = parseInt(String(item.airedEpisodeNumber ?? '0'), 10);
        res.ParentIndexNumber = seasonNumber;
        res.SeriesName = item.Series?.seriesName ?? '';
        res.SeriesId = seriesId ? formatId(seriesId, 'series') : '';
        res.SeasonName = seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`;
        res.PrimaryImageAspectRatio = 1.7777777777777777;
        res.ImageTags = { Primary: 'primary', Thumb: 'thumb' };
        // Episodes have no backdrop of their own; clients show the series'
        res.BackdropImageTags = [];

        if (seriesId) {
            res.SeriesPrimaryImageTag = 'primary';
            res.ParentBackdropItemId = res.SeriesId;
            res.ParentBackdropImageTags = ['backdrop'];
        }

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
        res.BackdropImageTags = [];

        if (item.SeriesId) {
            res.SeriesPrimaryImageTag = 'primary';
            res.ParentBackdropItemId = res.SeriesId;
            res.ParentBackdropImageTags = ['backdrop'];
        }
    }

    if (item.Files && item.Files.length > 0) {
        const file = item.Files[0];

        res.Path = file.path;
        res.Container = file.container || file.extension?.replace(/^\./, '') || undefined;
        if (Number.isFinite(file.duration)) {
            res.RunTimeTicks = Math.round((file.duration as number) * 10000000);
        }
        res.HasSubtitles = (file.Streams ?? []).some(stream => stream.codec_type === 'subtitle');
        res.MediaSources = createMediaSources(item.Files);
        res.Chapters = createChapters(file);
        res.Trickplay = createTrickplay(item.Files);
    }

    const track = item.TrackMovies?.[0] || item.TrackEpisodes?.[0];

    if (track) {
        const userData = res.UserData as Record<string, unknown>;
        userData.Played = (track.progress ?? 0) >= WATCHED_PROGRESS;
        userData.PlaybackPositionTicks = userData.Played ? 0 : Math.round((track.time ?? 0) * 10000000);
        userData.PlayCount = userData.Played ? 1 : 0;
        if (typeof res.RunTimeTicks === 'number' && res.RunTimeTicks > 0 && !userData.Played && (track.time ?? 0) > 0) {
            userData.PlayedPercentage = Math.min(100, (userData.PlaybackPositionTicks as number) / res.RunTimeTicks * 100);
        }
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
