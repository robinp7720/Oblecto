import { Movie } from '../../../../../models/movie';
import { File } from '../../../../../models/file';
import { createStreamsList, formatMediaItem, parseId, parseUuid } from '../../../helpers';
import { Stream } from '../../../../../models/stream';
import { Op } from 'sequelize';
import { Series } from '../../../../../models/series';
import { Episode } from '../../../../../models/episode';
import { TrackEpisode } from '../../../../../models/trackEpisode';
import { TrackMovie } from '../../../../../models/trackMovie';

/**
 *
 * @param server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.get('/items/:mediaid', async (req, res) => {
        const { id, type } = parseId(req.params.mediaid);
        const userId = req.params.userId || req.params.UserId || req.params.userid;
        const parsedUserId = userId ? parseUuid(userId) : null;

        let item = null;

        if (type === 'movie') {
            const include = [File];
            if (parsedUserId) {
                include.push({
                    model: TrackMovie,
                    required: false,
                    where: { userId: parsedUserId }
                });
            }
            item = await Movie.findByPk(id, { include });
        } else if (type === 'series') {
            // Series usually don't have direct tracking in this model, handled via episodes
            // But we can just return the series info
            item = await Series.findByPk(id);
        } else if (type === 'episode') {
            const include = [Series, File];
            if (parsedUserId) {
                include.push({
                    model: TrackEpisode,
                    required: false,
                    where: { userId: parsedUserId }
                });
            }
            item = await Episode.findByPk(id, { include });
        } else if (type === 'season') {
            // Reconstruct season from pseudo-ID
            // id = seriesId * 1000 + seasonNum
            const seriesId = Math.floor(id / 1000);
            const seasonNum = id % 1000;
            
            // Verify series exists? Optional, but good practice.
            // For now, just construct the object as expected by formatMediaItem
            item = {
                id: id,
                seasonName: 'Season ' + seasonNum,
                SeriesId: seriesId,
                indexNumber: seasonNum,
                // We might need to fetch series to get SeriesName if formatMediaItem needs it?
                // formatMediaItem for season just sets SeriesId.
            };
        }

        if (item) {
            res.send(formatMediaItem(item, type, embyEmulation));
        } else {
            res.status(404).send('Item not found');
        }
    });

    server.get('/items', async (req, res) => {
        let items = [];
        const includeItemTypes = req.params.IncludeItemTypes || req.params.includeItemTypes || req.params.includeitemtypes || '';
        const searchTerm = req.params.SearchTerm || req.params.searchTerm || req.params.searchterm;
        const startIndex = parseInt(req.params.StartIndex || req.params.startIndex || req.params.startindex) || 0;
        const limit = parseInt(req.params.Limit || req.params.limit) || 100;

        if (includeItemTypes.toLowerCase().includes('movie')) {
            let count = await Movie.count();

            let where = null;

            if (searchTerm) {
                where = { movieName: { [Op.like]: `%${searchTerm}%` } };
            }

            let results = await Movie.findAll({
                where,
                include: [File],
                limit: limit,
                offset: startIndex
            });

            items = results.map(movie => formatMediaItem(movie, 'movie', embyEmulation));

            res.send({
                'Items': items,
                'TotalRecordCount': count,
                'StartIndex': startIndex
            });
        } else if (includeItemTypes.toLowerCase().includes('series')) {
            let count = await Series.count();

            let where = null;

            if (searchTerm) {
                where = { seriesName: { [Op.like]: `%${searchTerm}%` } };
            }

            const sortBy = req.params.SortBy || req.params.sortBy || req.params.sortby || '';
            const sortOrder = req.params.SortOrder || req.params.sortOrder || req.params.sortorder || 'Ascending';
            const order = [];

            if (sortBy) {
                const parts = sortBy.split(',');
                for (const part of parts) {
                    const direction = sortOrder.toLowerCase().startsWith('desc') ? 'DESC' : 'ASC';
                    if (part === 'SortName') {
                        order.push(['seriesName', direction]);
                    } else if (part === 'PremiereDate' || part === 'ProductionYear') {
                        order.push(['firstAired', direction]);
                    } else if (part === 'DateCreated') {
                        order.push(['createdAt', direction]);
                    }
                }
            }

            if (order.length === 0) {
                order.push(['seriesName', 'ASC']);
            }

            let results = await Series.findAll({
                where,
                limit: limit,
                offset: startIndex,
                order: order
            });

            items = results.map(series => formatMediaItem(series, 'series', embyEmulation));

            res.send({
                'Items': items,
                'TotalRecordCount': count,
                'StartIndex': startIndex
            });
        } else if (includeItemTypes.toLowerCase().includes('episode')) {
            const parentId = req.params.ParentId || req.params.parentId || req.params.parentid;
            const userId = req.params.userId || req.params.UserId || req.params.userid;
            const parsedUserId = userId ? parseUuid(userId) : null;
            let where = {};

            if (parentId) {
                const parsed = parseId(parentId);
                if (parsed.type === 'series') {
                    where.SeriesId = parsed.id;
                } else if (parsed.type === 'season') {
                    where.SeriesId = Math.floor(parsed.id / 1000);
                    where.airedSeason = parsed.id % 1000;
                }
            }
            
            if (searchTerm) {
                where.episodeName = { [Op.like]: `%${searchTerm}%` };
            }

            let count = await Episode.count({ where });

            const include = [Series, File];
            if (parsedUserId) {
                include.push({
                    model: TrackEpisode,
                    required: false,
                    where: { userId: parsedUserId }
                });
            }

            let results = await Episode.findAll({
                where,
                include,
                limit: limit,
                offset: startIndex,
                order: [['airedSeason', 'ASC'], ['airedEpisodeNumber', 'ASC']]
            });

            items = results.map(ep => formatMediaItem(ep, 'episode', embyEmulation));

            res.send({
                'Items': items,
                'TotalRecordCount': count,
                'StartIndex': startIndex
            });
        } else if (includeItemTypes.toLowerCase().includes('season')) {
             const parentId = req.params.ParentId || req.params.parentId || req.params.parentid;
             let seriesId = null;

             if (parentId) {
                 const parsed = parseId(parentId);
                 if (parsed.type === 'series') {
                     seriesId = parsed.id;
                 }
             }

             if (!seriesId) {
                 // Return empty or all seasons? Usually seasons are fetched contextually.
                 return res.send({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
             }

            const episodes = await Episode.findAll({
                where: { SeriesId: seriesId },
                attributes: ['airedSeason'],
                order: [['airedSeason', 'ASC']]
            });

            const distinctSeasons = new Set();
            episodes.forEach(ep => distinctSeasons.add(ep.airedSeason));

            items = [];
            const sortedSeasons = Array.from(distinctSeasons).sort((a, b) => a - b);

            // Apply limit/offset to seasons list
            const pagedSeasons = sortedSeasons.slice(startIndex, startIndex + limit);

            for (const seasonNum of pagedSeasons) {
                const pseudoId = seriesId * 1000 + seasonNum;
                const seasonObj = {
                    id: pseudoId,
                    seasonName: 'Season ' + seasonNum,
                    SeriesId: seriesId,
                    indexNumber: seasonNum
                };
                items.push(formatMediaItem(seasonObj, 'season', embyEmulation));
            }

            res.send({
                'Items': items,
                'TotalRecordCount': sortedSeasons.length,
                'StartIndex': startIndex
            });
        } else {
            res.send({
                Items: [],
                TotalRecordCount: 0,
                StartIndex: 0
            });
        }
    });

    server.get('/items/:mediaid/similar', async (req, res) => {
        res.send({
            Items: [],
            TotalRecordCount: 0,
            StartIndex: 0
        });
    });

    server.get('/items/:mediaid/thememedia', async (req, res) => {
        res.send({
            'ThemeVideosResult': {
                'Items': [],
                'TotalRecordCount': 0,
                'StartIndex': 0
            },
            'ThemeSongsResult': {
                'Items': [],
                'TotalRecordCount': 0,
                'StartIndex': 0
            },
            'SoundtrackSongsResult': {
                'Items': [],
                'TotalRecordCount': 0,
                'StartIndex': 0
            }
        });
    });

    server.get('/items/:mediaid/images/primary', async (req, res) => {
        const { id, type } = parseId(req.params.mediaid);

        if (type === 'movie') {
            let movie = await Movie.findByPk(id, { include: [File] });
            let posterPath = embyEmulation.oblecto.artworkUtils.moviePosterPath(movie, 'medium');

            res.sendFile(posterPath);
        } else if (type === 'series') {
            let series = await Series.findByPk(id);
            let posterPath = embyEmulation.oblecto.artworkUtils.seriesPosterPath(series, 'medium');

            res.sendFile(posterPath);
        } else {
            res.status(404).send();
        }
    });

    server.get('/items/:mediaid/images/backdrop/:artworkid', async (req, res) => {
        const { id, type } = parseId(req.params.mediaid);

        if (type === 'movie') {
            let movie = await Movie.findByPk(id, { include: [File] });
            let posterPath = embyEmulation.oblecto.artworkUtils.movieFanartPath(movie, 'large');

            res.sendFile(posterPath);
        } else if (type === 'series') {
            let series = await Series.findByPk(id, { include: [File] });
            let posterPath = embyEmulation.oblecto.artworkUtils.movieFanartPath(series, 'large');

            res.sendFile(posterPath);
        } else {
            res.status(404).send();
        }
    });

    server.post('/items/:mediaid/playbackinfo', async (req, res) => {
        const { id, type } = parseId(req.params.mediaid);
        let files = [];

        if (type === 'movie') {
            let movie = await Movie.findByPk(id, {
                include: [
                    {
                        model: File,
                        include: [{ model: Stream }]
                    }
                ]
            });

            files = movie.Files;
        } else if (type === 'episode') {
            let episode = await Episode.findByPk(id, {
                include: [
                    {
                        model: File,
                        include: [{ model: Stream }]
                    }
                ]
            });

            files = episode.Files;
        }

        if (files.length === 0) {
            return res.status(404).send();
        }

        let file = files[0];

        if (req.params.MediaSourceId) {
            for (let f of files) {
                if (f.id === req.params.MediaSourceId) {
                    file = f;
                    break;
                }
            }
        }

        const streamSession = embyEmulation.oblecto.streamSessionController.newSession(file,
            {
                streamType: 'directhttp',
                target: {
                    formats: ['mp4, mkv'],
                    videoCodecs: ['h264', 'hevc'],
                    audioCodecs: []
                }
            });

        res.send({
            'MediaSources': files.map((f) => {
                return {
                    'Protocol': 'File',
                    'Id': f.id,
                    'Path': f.path,
                    'Type': 'Default',
                    'Container': 'mkv',
                    'Size': f.size,
                    'Name': f.name,
                    'IsRemote': false,
                    'ETag': '3670b404eb5adec1d6cd73868ad1801c',
                    'RunTimeTicks': f.duration * 10000000,
                    'ReadAtNativeFramerate': false,
                    'IgnoreDts': false,
                    'IgnoreIndex': false,
                    'GenPtsInput': false,
                    'SupportsTranscoding': true,
                    'SupportsDirectStream': true,
                    'SupportsDirectPlay': true,
                    'IsInfiniteStream': false,
                    'RequiresOpening': false,
                    'RequiresClosing': false,
                    'RequiresLooping': false,
                    'SupportsProbing': true,
                    'VideoType': 'VideoFile',
                    'MediaStreams': createStreamsList(f.Streams),
                    'MediaAttachments': [],
                    'Formats': [],
                    'Bitrate': f.size / f.duration,
                    'RequiredHttpHeaders': {},
                    'DefaultAudioStreamIndex': 1,
                    'DefaultSubtitleStreamIndex': 2
                };
            }),
            'PlaySessionId': streamSession.sessionId
        });
    });

    server.get('/userviews', async (req, res) => {
        res.send(
            {
                'Items': [
                    {
                        'Name': 'Collections',
                        'ServerId': embyEmulation.serverId,
                        'Id': 'collections',
                        'Etag': 'collections_etag',
                        'DateCreated': '2024-01-28T17:40:02.5928961Z',
                        'CanDelete': false,
                        'CanDownload': false,
                        'SortName': 'collections',
                        'ExternalUrls': [],
                        'Path': '/var/lib/jellyfin/root/default/Collections',
                        'EnableMediaSourceDisplay': true,
                        'ChannelId': null,
                        'Taglines': [],
                        'Genres': [],
                        'PlayAccess': 'Full',
                        'RemoteTrailers': [],
                        'ProviderIds': {},
                        'IsFolder': true,
                        'ParentId': 'e9d5075a555c1cbc394eec4cef295274',
                        'Type': 'CollectionFolder',
                        'People': [],
                        'Studios': [],
                        'GenreItems': [],
                        'LocalTrailerCount': 0,
                        'UserData': {
                            'PlaybackPositionTicks': 0,
                            'PlayCount': 0,
                            'IsFavorite': false,
                            'Played': false,
                            'Key': '9d7ad6af-e9af-a2da-b1a2-f6e00ad28fa6',
                            'ItemId': '00000000000000000000000000000000'
                        },
                        'ChildCount': 3,
                        'SpecialFeatureCount': 0,
                        'DisplayPreferencesId': '9d7ad6afe9afa2dab1a2f6e00ad28fa6',
                        'Tags': [],
                        'PrimaryImageAspectRatio': 1.7777777777777777,
                        'CollectionType': 'boxsets',
                        'ImageTags': { 'Primary': 'd2378e1f91138a4bc46aeb10c0af5cd4' },
                        'BackdropImageTags': [],
                        'ImageBlurHashes': { 'Primary': { 'd2378e1f91138a4bc46aeb10c0af5cd4': 'WNAwM6ITRjxuWBj[M{t7j[WBWBj[00t7t7WBt7WBofRjj[ofoffP' } },
                        'LocationType': 'FileSystem',
                        'MediaType': 'Unknown',
                        'LockedFields': [],
                        'LockData': false
                    }, {
                        'Name': 'Movies',
                        'ServerId': embyEmulation.serverId,
                        'Id': 'movies',
                        'Etag': 'movies_etag',
                        'DateCreated': '2024-01-12T13:09:59.8045143Z',
                        'CanDelete': false,
                        'CanDownload': false,
                        'SortName': 'movies',
                        'ExternalUrls': [],
                        'Path': '/var/lib/jellyfin/root/default/Movies',
                        'EnableMediaSourceDisplay': true,
                        'ChannelId': null,
                        'Taglines': [],
                        'Genres': [],
                        'PlayAccess': 'Full',
                        'RemoteTrailers': [],
                        'ProviderIds': {},
                        'IsFolder': true,
                        'ParentId': 'e9d5075a555c1cbc394eec4cef295274',
                        'Type': 'CollectionFolder',
                        'People': [],
                        'Studios': [],
                        'GenreItems': [],
                        'LocalTrailerCount': 0,
                        'UserData': {
                            'PlaybackPositionTicks': 0,
                            'PlayCount': 0,
                            'IsFavorite': false,
                            'Played': false,
                            'Key': 'f137a2dd-21bb-c1b9-9aa5-c0f6bf02a805',
                            'ItemId': '00000000000000000000000000000000'
                        },
                        'ChildCount': 3,
                        'SpecialFeatureCount': 0,
                        'DisplayPreferencesId': 'f137a2dd21bbc1b99aa5c0f6bf02a805',
                        'Tags': [],
                        'PrimaryImageAspectRatio': 1.7777777777777777,
                        'CollectionType': 'movies',
                        'ImageTags': { 'Primary': '7242804fea84f197cc99d0be14caf89f' },
                        'BackdropImageTags': [],
                        'ImageBlurHashes': { 'Primary': { '7242804fea84f197cc99d0be14caf89f': 'WCB_|~t60eaeN_kCxboejYWVkCWX0KWB-;ofoyfir=WCs:ofj]oc' } },
                        'LocationType': 'FileSystem',
                        'MediaType': 'Unknown',
                        'LockedFields': [],
                        'LockData': false
                    }, {
                        'Name': 'Shows',
                        'ServerId': embyEmulation.serverId,
                        'Id': 'shows',
                        'Etag': 'show_etag',
                        'DateCreated': '2024-01-12T13:10:19.864503Z',
                        'CanDelete': false,
                        'CanDownload': false,
                        'SortName': 'shows',
                        'ExternalUrls': [],
                        'Path': '/var/lib/jellyfin/root/default/Shows',
                        'EnableMediaSourceDisplay': true,
                        'ChannelId': null,
                        'Taglines': [],
                        'Genres': [],
                        'PlayAccess': 'Full',
                        'RemoteTrailers': [],
                        'ProviderIds': {},
                        'IsFolder': true,
                        'ParentId': 'e9d5075a555c1cbc394eec4cef295274',
                        'Type': 'CollectionFolder',
                        'People': [],
                        'Studios': [],
                        'GenreItems': [],
                        'LocalTrailerCount': 0,
                        'UserData': {
                            'PlaybackPositionTicks': 0,
                            'PlayCount': 0,
                            'IsFavorite': false,
                            'Played': false,
                            'Key': 'a656b907-eb3a-7353-2e40-e44b968d0225',
                            'ItemId': '00000000000000000000000000000000'
                        },
                        'ChildCount': 2,
                        'SpecialFeatureCount': 0,
                        'DisplayPreferencesId': 'a656b907eb3a73532e40e44b968d0225',
                        'Tags': [],
                        'PrimaryImageAspectRatio': 1.7777777777777777,
                        'CollectionType': 'tvshows',
                        'ImageTags': { 'Primary': '49b4446f155951fdf5253ec5d0b793fb' },
                        'BackdropImageTags': [],
                        'ImageBlurHashes': { 'Primary': { '49b4446f155951fdf5253ec5d0b793fb': 'WD8W]gRi0LkDxZxatkaeRQs:oIW=8_SO-;xZRjR\u002BM|jZt7bGa~WC' } },
                        'LocationType': 'FileSystem',
                        'MediaType': 'Unknown',
                        'LockedFields': [],
                        'LockData': false
                    }
                ],
                'TotalRecordCount': 8,
                'StartIndex': 0
            }
        );
    });
};