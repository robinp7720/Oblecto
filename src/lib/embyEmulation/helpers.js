import path from 'path';

const normalizeBoolean = (value) => value === true || value === 1;

const resolveDefaultStreamIndex = (streams, codecType) => {
    const matching = streams.filter((stream) => stream.codec_type === codecType);

    if (matching.length === 0) return -1;

    const defaultStream = matching.find((stream) => normalizeBoolean(stream.disposition_default));

    return (defaultStream || matching[0]).index;
};

export const createStreamsList = (streams) => {
    let mediaStreams = [];

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

export const formatFileId = (value) => {
    if (value === null || value === undefined) return '';

    const raw = String(value).trim();

    if (!raw) return '';

    const normalized = raw.replace(/-/g, '');

    if (/^[0-9a-fA-F]{32}$/.test(normalized)) {
        return normalized.toLowerCase();
    }

    if (/^[0-9a-fA-F]+$/.test(normalized)) {
        return normalized.toLowerCase().padStart(32, '0');
    }

    const numeric = Number(raw);

    if (Number.isFinite(numeric)) {
        return numeric.toString(16).padStart(32, '0');
    }

    return raw;
};

export const parseFileId = (value) => {
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

export const createMediaSources = (files) => {
    if (!Array.isArray(files)) return [];

    return files.map((file) => {
        const streams = Array.isArray(file.Streams) ? file.Streams : [];
        const container = file.container
            || (file.extension ? file.extension.replace(/^\./, '') : '')
            || path.extname(file.path || '').replace('.', '')
            || 'mkv';
        const name = file.name
            || (file.path ? path.basename(file.path, path.extname(file.path)) : 'Unknown');
        const runtimeTicks = Number.isFinite(file.duration) ? file.duration * 10000000 : 0;
        const bitrate = Number.isFinite(file.size) && Number.isFinite(file.duration) && file.duration > 0
            ? Math.floor(file.size / file.duration)
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

export const formatUuid = (id) => {
    const hex = Number(id).toString(16).padStart(32, '0');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const parseUuid = (uuid) => {
    return parseInt(uuid.replace(/-/g, ''), 16);
};

export const formatId = (id, type) => {
    let prefix = '0';

    if (type === 'movie') prefix = '1';
    else if (type === 'series') prefix = '2';
    else if (type === 'episode') prefix = '3';
    else if (type === 'season') prefix = '4';
    else if (type === 'user') prefix = 'f';

    return prefix + Number(id).toString(16).padStart(31, '0');
};

export const parseId = (value) => {
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

            if (/^\d+$/.test(rest)) {
                const parsed = parseInt(rest, 10);

                return { id: parsed, type };
            }

            if (/^[0-9a-fA-F]+$/.test(rest)) {
                const parsed = parseInt(rest, 16);

                return { id: parsed, type };
            }

            return { id: NaN, type };
        }
    }

    const typeCode = lower[0];
    let type = 'unknown';

    if (typeCode === '1') type = 'movie';
    else if (typeCode === '2') type = 'series';
    else if (typeCode === '3') type = 'episode';
    else if (typeCode === '4') type = 'season';
    else if (typeCode === 'f') type = 'user';

    if (type !== 'unknown') {
        return {
            id: parseInt(normalized.slice(1), 16),
            type
        };
    }

    if (/^[0-9a-fA-F]{32}$/.test(normalized)) {
        return { id: parseInt(normalized, 16), type: 'unknown' };
    }

    if (/^\d+$/.test(raw)) {
        return { id: parseInt(raw, 10), type: 'unknown' };
    }

    if (/^[0-9a-fA-F]+$/.test(raw)) {
        return { id: parseInt(raw, 16), type: 'unknown' };
    }

    return { id: NaN, type: 'unknown' };
};

export const formatMediaItem = (item, type, embyEmulation) => {
    const id = formatId(item.id, type);

    const res = {
        'Name': item.movieName || item.seriesName || item.episodeName || item.seasonName,
        'ServerId': embyEmulation.serverId,
        'Id': id,
        'HasSubtitles': true,
        'Container': 'mkv',
        'PremiereDate': item.releaseDate || item.firstAired,
        'CriticRating': 82,
        'OfficialRating': item.rating || 'PG-13',
        'CommunityRating': item.popularity || 2.6,
        'RunTimeTicks': (item.runtime || 0) * 60 * 10000000,
        'ProductionYear': (item.releaseDate || item.firstAired || '').substring(0, 4),
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
        const seasonNumber = parseInt(item.airedSeason);

        res.IndexNumber = parseInt(item.airedEpisodeNumber);
        res.ParentIndexNumber = seasonNumber;
        res.SeriesName = item.Series ? item.Series.seriesName : '';
        res.SeriesId = seriesId ? formatId(seriesId, 'series') : '';
        res.SeasonName = 'Season ' + item.airedSeason;
        res.PrimaryImageAspectRatio = 1.7777777777777777;

        if (seriesId && Number.isFinite(seasonNumber)) {
            const seasonId = (seriesId * 1000) + seasonNumber;

            res.SeasonId = formatId(seasonId, 'season');
            res.ParentId = res.SeasonId;
        }
    }

    if (type === 'season') {
        res.SeriesId = item.SeriesId ? formatId(item.SeriesId, 'series') : '';
        res.SeasonName = item.seasonName;
        res.IndexNumber = parseInt(item.indexNumber);
        res.ParentId = res.SeriesId;
    }

    if (item.Files && item.Files.length > 0) {
        res.Path = item.Files[0].path;
        res.Container = item.Files[0].container || res.Container;
        if (Number.isFinite(item.Files[0].duration)) {
            res.RunTimeTicks = item.Files[0].duration * 10000000;
        }
        res.MediaSources = createMediaSources(item.Files);
    }

    const track = item.TrackMovies ? item.TrackMovies[0] : (item.TrackEpisodes ? item.TrackEpisodes[0] : null);

    if (track) {
        res.UserData.PlaybackPositionTicks = (track.time || 0) * 10000000;
        res.UserData.Played = track.progress >= 1;
        res.UserData.PlayCount = res.UserData.Played ? 1 : 0;
        if (track.updatedAt) {
            res.UserData.LastPlayedDate = track.updatedAt.toISOString();
        }
    }

    return res;
};
