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

export const parseId = (id) => {
    const typeCode = id[0];
    const numericId = parseInt(id.slice(1), 16);
    let type = 'unknown';

    if (typeCode === '1') type = 'movie';
    else if (typeCode === '2') type = 'series';
    else if (typeCode === '3') type = 'episode';
    else if (typeCode === '4') type = 'season';
    else if (typeCode === 'f') type = 'user';

    return { id: numericId, type };
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
        res.Container = item.Files[0].container;
        res.RunTimeTicks = item.Files[0].duration * 10000000;
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
