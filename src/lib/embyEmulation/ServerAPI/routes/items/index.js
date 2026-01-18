import { Movie } from '../../../../../models/movie';
import { File } from '../../../../../models/file';
import { createMediaSources, formatMediaItem, parseFileId, parseId, parseUuid } from '../../../helpers';
import { Stream } from '../../../../../models/stream';
import { Op } from 'sequelize';
import { Series } from '../../../../../models/series';
import { Episode } from '../../../../../models/episode';
import { TrackEpisode } from '../../../../../models/trackEpisode';
import { TrackMovie } from '../../../../../models/trackMovie';
import { fileExists } from '../../../../../submodules/utils';
import logger from '../../../../../submodules/logger/index.js';

/**
 *
 * @param server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    const sendImageIfExists = async (res, imagePath) => {
        if (!imagePath || !(await fileExists(imagePath))) return false;
        res.sendFile(imagePath);
        return true;
    };

    const buildMovieInclude = (userId) => {
        const include = [
            {
                model: File,
                include: [{ model: Stream }]
            }
        ];

        if (userId) {
            include.push({
                model: TrackMovie,
                required: false,
                where: { userId }
            });
        }

        return include;
    };

    const buildEpisodeInclude = (userId) => {
        const include = [Series, { model: File, include: [{ model: Stream }] }];

        if (userId) {
            include.push({
                model: TrackEpisode,
                required: false,
                where: { userId }
            });
        }

        return include;
    };

    const resolveItemById = async (mediaId, userId = null) => {
        const parsed = parseId(mediaId);
        const numericId = parsed.id;
        let resolvedType = parsed.type;
        let item = null;

        if (resolvedType === 'movie' && Number.isFinite(numericId)) {
            item = await Movie.findByPk(numericId, { include: buildMovieInclude(userId) });
        } else if (resolvedType === 'series' && Number.isFinite(numericId)) {
            item = await Series.findByPk(numericId);
        } else if (resolvedType === 'episode' && Number.isFinite(numericId)) {
            item = await Episode.findByPk(numericId, { include: buildEpisodeInclude(userId) });
        } else if (resolvedType === 'season' && Number.isFinite(numericId)) {
            const seriesId = Math.floor(numericId / 1000);

            const series = await Series.findByPk(seriesId);
            const seasonNum = numericId % 1000;

            logger.debug(series.seriesName);

            item = {
                id: numericId,
                seasonName: 'Season ' + seasonNum,
                seriesName: series.seriesName,
                SeriesId: seriesId,
                indexNumber: seasonNum,
            };
        }

        if (!item && Number.isFinite(numericId)) {
            item = await Movie.findByPk(numericId, { include: buildMovieInclude(userId) });
            if (item) {
                resolvedType = 'movie';
            } else {
                item = await Episode.findByPk(numericId, { include: buildEpisodeInclude(userId) });
                if (item) {
                    resolvedType = 'episode';
                } else {
                    item = await Series.findByPk(numericId);
                    if (item) {
                        resolvedType = 'series';
                    }
                }
            }
        }

        return { item, type: resolvedType };
    };

    server.get('/items/:mediaid', async (req, res) => {
        const userId = req.query.userId || req.query.UserId || req.query.userid;
        const parsedUserId = userId ? parseUuid(userId) : null;
        const { item, type } = await resolveItemById(req.params.mediaid, parsedUserId);

        if (item) {
            res.send(formatMediaItem(item, type, embyEmulation));
        } else {
            res.status(404).send('Item not found');
        }
    });

    server.get('/items', async (req, res) => {
        let items = [];
        const includeItemTypes = req.query.IncludeItemTypes || req.query.includeItemTypes || req.query.includeitemtypes || '';
        const searchTerm = req.query.SearchTerm || req.query.searchTerm || req.query.searchterm;
        const startIndex = parseInt(req.query.StartIndex || req.query.startIndex || req.query.startindex) || 0;
        const limit = parseInt(req.query.Limit || req.query.limit) || 100;

        if (includeItemTypes.toLowerCase().includes('movie')) {
            let count = await Movie.count();

            let where = null;

            if (searchTerm) {
                where = { movieName: { [Op.like]: `%${searchTerm}%` } };
            }

            let results = await Movie.findAll({
                where,
                include: [{ model: File, include: [{ model: Stream }] }],
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

            const sortBy = req.query.SortBy || req.query.sortBy || req.query.sortby || '';
            const sortOrder = req.query.SortOrder || req.query.sortOrder || req.query.sortorder || 'Ascending';
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
            const parentId = req.query.ParentId || req.query.parentId || req.query.parentid;
            const userId = req.query.userId || req.query.UserId || req.query.userid;
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

            const include = [Series, { model: File, include: [{ model: Stream }] }];

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
            const parentId = req.query.ParentId || req.query.parentId || req.query.parentid;
            let seriesId = null;

            if (parentId) {
                const parsed = parseId(parentId);

                if (parsed.type === 'series') {
                    seriesId = parsed.id;
                }
            }

            if (!seriesId) {
                // Return empty or all seasons? Usually seasons are fetched contextually.
                return res.send({
                    Items: [], TotalRecordCount: 0, StartIndex: 0
                });
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
                const pseudoId = seriesId * 1000 + parseInt(seasonNum);
                const seasonObj = {
                    id: pseudoId,
                    seasonName: 'Season ' + seasonNum,
                    seriesName: series.seriesName,
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
        const { item, type } = await resolveItemById(req.params.mediaid);

        if (type === 'movie') {
            if (!item) return res.status(404).send();
            let posterPath = embyEmulation.oblecto.artworkUtils.moviePosterPath(item, 'medium');

            if (await sendImageIfExists(res, posterPath)) return;
        } else if (type === 'series') {
            if (!item) return res.status(404).send();
            let posterPath = embyEmulation.oblecto.artworkUtils.seriesPosterPath(item, 'medium');

            if (await sendImageIfExists(res, posterPath)) return;
        } else if (type === 'episode') {
            if (!item) return res.status(404).send();
            let bannerPath = embyEmulation.oblecto.artworkUtils.episodeBannerPath(item, 'medium');

            if (await sendImageIfExists(res, bannerPath)) return;
            if (item.Series) {
                let seriesPosterPath = embyEmulation.oblecto.artworkUtils.seriesPosterPath(item.Series, 'medium');

                if (await sendImageIfExists(res, seriesPosterPath)) return;
            }
        } else {
            return res.status(404).send();
        }

        return res.status(404).send();
    });

    server.get('/items/:mediaid/images/backdrop/:artworkid', async (req, res) => {
        const { item, type } = await resolveItemById(req.params.mediaid);

        if (type === 'movie') {
            if (!item) return res.status(404).send();
            let posterPath = embyEmulation.oblecto.artworkUtils.movieFanartPath(item, 'large');

            if (await sendImageIfExists(res, posterPath)) return;
        } else if (type === 'series') {
            if (!item) return res.status(404).send();
            // No dedicated series fanart; fall back to poster so clients at least get an image.
            let posterPath = embyEmulation.oblecto.artworkUtils.seriesPosterPath(item, 'large');

            if (await sendImageIfExists(res, posterPath)) return;
        } else {
            return res.status(404).send();
        }

        return res.status(404).send();
    });

    server.post('/items/:mediaid/playbackinfo', async (req, res) => {
        const { item, type } = await resolveItemById(req.params.mediaid);
        let files = [];

        if (type === 'movie' && item) {
            files = item.Files;
        } else if (type === 'episode' && item) {
            files = item.Files;
        }

        if (files.length === 0) {
            return res.status(404).send();
        }

        let file = files[0];

        if (req.query.MediaSourceId) {
            const parsedMediaSourceId = parseFileId(req.query.MediaSourceId);

            for (let f of files) {
                if (parsedMediaSourceId !== null && f.id === parsedMediaSourceId) {
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
            'MediaSources': createMediaSources(files),
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

    // Additional Items Routes
    server.get('/items/filters', async (req, res) => { res.send({}); });
    server.get('/items/filters2', async (req, res) => { res.send({}); });
    server.get('/items/:itemid/images', async (req, res) => { res.send([]); });
    server.get('/items/:itemid/images/:imagetype', async (req, res) => { res.status(404).send('Not Found'); });
    // server.get('/items/:itemid/images/:imagetype/:imageindex', ...); // Already partially covered?
    server.get('/items/:itemid/images/:imagetype/:imageindex/index', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/items/:itemid/instantmix', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });
    server.get('/items/:itemid/externalidinfos', async (req, res) => { res.send([]); });

    server.post('/items/remotesearch/apply/:itemid', async (req, res) => { res.status(204).send(); });
    server.post('/items/remotesearch/book', async (req, res) => { res.send([]); });
    server.post('/items/remotesearch/boxset', async (req, res) => { res.send([]); });
    server.post('/items/remotesearch/movie', async (req, res) => { res.send([]); });
    server.post('/items/remotesearch/musicalbum', async (req, res) => { res.send([]); });
    server.post('/items/remotesearch/musicartist', async (req, res) => { res.send([]); });
    server.post('/items/remotesearch/musicvideo', async (req, res) => { res.send([]); });
    server.post('/items/remotesearch/person', async (req, res) => { res.send([]); });
    server.post('/items/remotesearch/series', async (req, res) => { res.send([]); });
    server.post('/items/remotesearch/trailer', async (req, res) => { res.send([]); });

    server.post('/items/:itemid/refresh', async (req, res) => { res.status(204).send(); });
    server.get('/items/:itemid/contenttype', async (req, res) => { res.send({}); }); // Guessing response
    server.get('/items/:itemid/metadataeditor', async (req, res) => { res.send({}); });
    server.get('/items/:itemid/ancestors', async (req, res) => { res.send([]); });
    server.get('/items/:itemid/criticreviews', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });
    server.get('/items/:itemid/download', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/items/:itemid/file', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/items/:itemid/themesongs', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });
    server.get('/items/:itemid/themevideos', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });
    server.get('/items/counts', async (req, res) => { res.send({}); });
    server.get('/items/:itemid/remoteimages', async (req, res) => { res.send({
        Images: [], TotalRecordCount: 0, Providers: []
    }); });
    server.get('/items/:itemid/remoteimages/download', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/items/:itemid/remoteimages/providers', async (req, res) => { res.send([]); });
    server.get('/items/:itemid/remotesearch/subtitles/:language', async (req, res) => { res.send([]); });
    server.get('/items/:itemid/remotesearch/subtitles/:subtitleid', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/items/suggestions', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });
    server.get('/items/:itemid/intros', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });
    server.get('/items/:itemid/localtrailers', async (req, res) => { res.send([]); });
    server.get('/items/:itemid/specialfeatures', async (req, res) => { res.send([]); });
    server.get('/items/root', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });

    // Movies
    server.get('/movies/:itemid/similar', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });
    server.get('/movies/recommendations', async (req, res) => { res.send([]); });

    // Shows
    server.get('/shows/:itemid/similar', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });
    server.get('/shows/upcoming', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });

    // Trailers
    server.get('/trailers', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });
    server.get('/trailers/:itemid/similar', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });

    // Search
    server.get('/search/hints', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0
    }); });
};
