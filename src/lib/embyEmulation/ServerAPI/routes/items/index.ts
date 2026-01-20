import { Movie } from '../../../../../models/movie';
import { File } from '../../../../../models/file';
import { createMediaSources, formatFileId, formatId, formatMediaItem, parseFileId, parseId, parseUuid } from '../../../helpers';
import { Stream } from '../../../../../models/stream';
import { Op } from 'sequelize';
import { Series } from '../../../../../models/series';
import { Episode } from '../../../../../models/episode';
import { TrackEpisode } from '../../../../../models/trackEpisode';
import { TrackMovie } from '../../../../../models/trackMovie';
import { fileExists } from '../../../../../submodules/utils';
import logger from '../../../../../submodules/logger/index.js';
import { getEmbyToken, getRequestValue } from '../../requestUtils.js';
import { getLastMediaSource, getPlaybackEntry, setLastMediaSource, upsertPlaybackEntry } from '../../playbackState.js';
import { v4 as uuidv4 } from 'uuid';

/**
 *
 * @param server
 * @param embyEmulation
 */
export default (server, embyEmulation) => {
    const sendImageIfExists = async (res, imagePath) => {
        if (!imagePath || !(await fileExists(imagePath))) return false;
        res.sendFile(imagePath);
        return true;
    };

    const normalizeImageType = (rawType) => (rawType || '').toString().toLowerCase();
    const normalizeQueryList = (query, ...keys) => {
        const values = [];

        for (const key of keys) {
            if (query[key] === undefined) continue;
            const raw = query[key];

            if (Array.isArray(raw)) {
                for (const entry of raw) {
                    values.push(entry);
                }
            } else {
                values.push(raw);
            }
        }
        return values
            .flatMap(value => String(value).split(','))
            .map(value => value.trim())
            .filter(value => value.length > 0);
    };
    const normalizeQueryString = (query, ...keys) => {
        const values = normalizeQueryList(query, ...keys);

        return values.length > 0 ? values.join(',') : '';
    };
    const normalizeItemTypes = (query) => {
        return normalizeQueryList(query, 'IncludeItemTypes', 'includeItemTypes', 'includeitemtypes')
            .map(value => value.toLowerCase());
    };
    const toSearchHint = (item, type) => {
        const id = formatId(item.id, type);
        const name = item.movieName || item.seasonName || item.episodeName || item.seriesName;
        const productionYearRaw = (item.releaseDate || item.firstAired || '').substring(0, 4);
        const productionYear = Number.isFinite(parseInt(productionYearRaw, 10)) ? parseInt(productionYearRaw, 10) : null;
        const hint = {
            Id: id,
            Name: name,
            Type: type.charAt(0).toUpperCase() + type.slice(1),
            IsFolder: type === 'series' || type === 'season',
            MediaType: 'Video',
            ProductionYear: productionYear,
            PrimaryImageTag: 'primary',
        };

        if (type === 'episode') {
            hint.IndexNumber = parseInt(item.airedEpisodeNumber);
            hint.ParentIndexNumber = parseInt(item.airedSeason);
            hint.Series = item.Series ? item.Series.seriesName : null;
            hint.ThumbImageTag = 'thumb';
        }

        return hint;
    };
    const shuffleItems = (items) => {
        for (let i = items.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));

            [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
    };

    const readQueryNumber = (query, ...keys) => {
        for (const key of keys) {
            if (query[key] !== undefined) {
                const parsed = parseInt(query[key], 10);

                if (Number.isFinite(parsed)) return parsed;
            }
        }
        return null;
    };

    const chooseSizeKey = (sizeMap, query) => {
        if (!sizeMap || Object.keys(sizeMap).length === 0) return null;
        const target = readQueryNumber(query, 'maxwidth', 'maxheight', 'width', 'height', 'fillwidth', 'fillheight');
        const entries = Object.entries(sizeMap)
            .map(([key, value]) => ({ key, value: Number(value) }))
            .filter(entry => Number.isFinite(entry.value))
            .sort((a, b) => a.value - b.value);

        if (entries.length === 0) return null;

        if (target === null) {
            const medium = entries.find(entry => entry.key === 'medium');

            return medium ? medium.key : entries[Math.floor(entries.length / 2)].key;
        }

        for (const entry of entries) {
            if (entry.value >= target) return entry.key;
        }

        return entries[entries.length - 1].key;
    };

    const findFirstExistingImage = async (res, candidates) => {
        for (const candidate of candidates) {
            if (await sendImageIfExists(res, candidate)) return true;
        }
        return false;
    };

    const resolveImageCandidates = (item, type, imageType, query) => {
        const artwork = embyEmulation.oblecto.artworkUtils;
        const config = embyEmulation.oblecto.config.artwork;
        const normalized = normalizeImageType(imageType);

        if (type === 'movie') {
            if (normalized === 'primary' || normalized === 'poster' || normalized === 'box' || normalized === 'boxrear') {
                const sizeKey = chooseSizeKey(config.poster, query);

                return [
                    artwork.moviePosterPath(item, sizeKey),
                    artwork.moviePosterPath(item, null),
                ];
            }

            if (normalized === 'backdrop' || normalized === 'fanart' || normalized === 'art') {
                const sizeKey = chooseSizeKey(config.fanart, query);

                return [
                    artwork.movieFanartPath(item, sizeKey),
                    artwork.movieFanartPath(item, null),
                ];
            }
        }

        if (type === 'series') {
            if (normalized === 'primary' || normalized === 'poster' || normalized === 'banner' || normalized === 'thumb') {
                const sizeKey = chooseSizeKey(config.poster, query);

                return [
                    artwork.seriesPosterPath(item, sizeKey),
                    artwork.seriesPosterPath(item, null),
                ];
            }

            if (normalized === 'backdrop' || normalized === 'fanart' || normalized === 'art') {
                const sizeKey = chooseSizeKey(config.poster, query);

                return [
                    artwork.seriesPosterPath(item, sizeKey),
                    artwork.seriesPosterPath(item, null),
                ];
            }
        }

        if (type === 'episode') {
            if (normalized === 'primary' || normalized === 'banner' || normalized === 'thumb') {
                const sizeKey = chooseSizeKey(config.banner, query);
                const candidates = [
                    artwork.episodeBannerPath(item, sizeKey),
                    artwork.episodeBannerPath(item, null),
                ];

                if (item.Series) {
                    const seriesSize = chooseSizeKey(config.poster, query);

                    candidates.push(artwork.seriesPosterPath(item.Series, seriesSize));
                    candidates.push(artwork.seriesPosterPath(item.Series, null));
                }
                return candidates;
            }
        }

        if (type === 'season') {
            if (normalized === 'primary' || normalized === 'poster' || normalized === 'banner' || normalized === 'thumb') {
                const sizeKey = chooseSizeKey(config.poster, query);

                return [
                    artwork.seriesPosterPath({ id: Math.floor(item.id / 1000) }, sizeKey),
                    artwork.seriesPosterPath({ id: Math.floor(item.id / 1000) }, null),
                ];
            }
        }

        return [];
    };

    const handleItemImageRequest = async (req, res, imageTypeOverride = null) => {
        const { item, type } = await resolveItemById(req.params.mediaid);

        if (!item) return res.status(404).send();

        const requestedType = imageTypeOverride || req.params.imagetype || req.params.imageType || 'primary';
        const imageIndex = req.params.imageindex ?? req.query.imageindex ?? req.query.imageIndex;

        if (imageIndex !== undefined) {
            const parsedIndex = parseInt(imageIndex, 10);

            if (!Number.isFinite(parsedIndex) || parsedIndex !== 0) return res.status(404).send();
        }

        const candidates = resolveImageCandidates(item, type, requestedType, req.query || {});

        if (candidates.length === 0) return res.status(404).send();

        const found = await findFirstExistingImage(res, candidates);

        if (found) return;

        return res.status(404).send();
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
        const includeItemTypes = normalizeItemTypes(req.query);
        const searchTerm = req.query.SearchTerm || req.query.searchTerm || req.query.searchterm;
        const startIndex = parseInt(req.query.StartIndex || req.query.startIndex || req.query.startindex) || 0;
        const limit = parseInt(req.query.Limit || req.query.limit) || 100;
        const sortBy = normalizeQueryList(req.query, 'SortBy', 'sortBy', 'sortby').map(value => value.toLowerCase());
        const perTypeLimit = limit + startIndex;
        const wantsRandom = sortBy.includes('random');
        const wantsMovie = includeItemTypes.includes('movie');
        const wantsSeries = includeItemTypes.includes('series');
        const wantsEpisode = includeItemTypes.includes('episode');
        const wantsSeason = includeItemTypes.includes('season');

        if (includeItemTypes.length === 0) {
            return res.send({
                Items: [],
                TotalRecordCount: 0,
                StartIndex: 0
            });
        }

        const aggregatedItems = [];
        let totalCount = 0;

        if (wantsMovie) {
            let where = null;

            if (searchTerm) {
                where = { movieName: { [Op.like]: `%${searchTerm}%` } };
            }

            const count = await Movie.count({ where });

            totalCount += count;

            const results = await Movie.findAll({
                where,
                include: [{ model: File, include: [{ model: Stream }] }],
                limit: perTypeLimit,
                offset: startIndex,
                order: [['movieName', 'ASC']]
            });

            aggregatedItems.push(...results.map(movie => formatMediaItem(movie, 'movie', embyEmulation)));
        }

        if (wantsSeries) {
            let where = null;

            if (searchTerm) {
                where = { seriesName: { [Op.like]: `%${searchTerm}%` } };
            }

            const count = await Series.count({ where });

            totalCount += count;

            const sortByValue = normalizeQueryString(req.query, 'SortBy', 'sortBy', 'sortby');
            const sortOrder = normalizeQueryString(req.query, 'SortOrder', 'sortOrder', 'sortorder') || 'Ascending';
            const order = [];

            if (sortByValue) {
                const parts = sortByValue.split(',');

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

            const results = await Series.findAll({
                where,
                limit: perTypeLimit,
                offset: startIndex,
                order
            });

            aggregatedItems.push(...results.map(series => formatMediaItem(series, 'series', embyEmulation)));
        }

        if (wantsEpisode) {
            const parentId = req.query.ParentId || req.query.parentId || req.query.parentid;
            const userId = req.query.userId || req.query.UserId || req.query.userid;
            const parsedUserId = userId ? parseUuid(userId) : null;
            const where = {};

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

            const count = await Episode.count({ where });

            totalCount += count;

            const include = [Series, { model: File, include: [{ model: Stream }] }];

            if (parsedUserId) {
                include.push({
                    model: TrackEpisode,
                    required: false,
                    where: { userId: parsedUserId }
                });
            }

            const results = await Episode.findAll({
                where,
                include,
                limit: perTypeLimit,
                offset: startIndex,
                order: [['airedSeason', 'ASC'], ['airedEpisodeNumber', 'ASC']]
            });

            aggregatedItems.push(...results.map(ep => formatMediaItem(ep, 'episode', embyEmulation)));
        }

        if (wantsSeason) {
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
                if (includeItemTypes.length === 1) {
                    return res.send({
                        Items: [], TotalRecordCount: 0, StartIndex: 0
                    });
                }
            } else {
                const series = await Series.findByPk(seriesId);

                if (!series) {
                    if (includeItemTypes.length === 1) {
                        return res.send({
                            Items: [], TotalRecordCount: 0, StartIndex: 0
                        });
                    }
                } else {
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

                    totalCount += sortedSeasons.length;
                    aggregatedItems.push(...items);
                }
            }
        }

        let finalItems = aggregatedItems;

        if (wantsRandom) {
            finalItems = shuffleItems(finalItems);
        } else {
            finalItems = aggregatedItems.sort((a, b) => {
                const nameA = (a.Name || '').toLowerCase();
                const nameB = (b.Name || '').toLowerCase();

                return nameA.localeCompare(nameB);
            });
        }

        finalItems = finalItems.slice(startIndex, startIndex + limit);

        res.send({
            Items: finalItems,
            TotalRecordCount: totalCount,
            StartIndex: startIndex
        });
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
        return handleItemImageRequest(req, res, 'primary');
    });

    server.get('/items/:mediaid/images/backdrop/:artworkid', async (req, res) => {
        return handleItemImageRequest(req, res, 'backdrop');
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
        const token = getEmbyToken(req);
        const mediaSourceId = getRequestValue(req, 'MediaSourceId');
        const playSessionId = getRequestValue(req, 'PlaySessionId') || uuidv4();
        const existingPlayback = getPlaybackEntry(embyEmulation, token, playSessionId);
        const lastMediaSource = getLastMediaSource(embyEmulation, token, req.params.mediaid);

        const resolvedMediaSourceId = mediaSourceId ?? existingPlayback?.mediaSourceId ?? lastMediaSource;

        if (resolvedMediaSourceId) {
            const parsedMediaSourceId = parseFileId(resolvedMediaSourceId);

            for (const f of files) {
                if (parsedMediaSourceId !== null && f.id === parsedMediaSourceId) {
                    file = f;
                    break;
                }
            }
        }

        upsertPlaybackEntry(embyEmulation, token, {
            playSessionId,
            itemId: req.params.mediaid,
            mediaSourceId: file?.id ?? null
        });
        setLastMediaSource(embyEmulation, token, req.params.mediaid, file?.id ?? null);

        res.send({
            'MediaSources': createMediaSources(files),
            'PlaySessionId': playSessionId,
            'MediaSourceId': formatFileId(file?.id)
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
    server.get('/items/:mediaid/images/:imagetype', async (req, res) => handleItemImageRequest(req, res));
    server.get('/items/:mediaid/images/:imagetype/:imageindex', async (req, res) => handleItemImageRequest(req, res));
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
    server.get('/search/hints', async (req, res) => {
        const searchTerm = req.query.SearchTerm || req.query.searchTerm || req.query.searchterm;
        const includeItemTypes = normalizeItemTypes(req.query);
        const startIndex = parseInt(req.query.StartIndex || req.query.startIndex || req.query.startindex) || 0;
        const limit = parseInt(req.query.Limit || req.query.limit) || 100;
        const wantsMovie = includeItemTypes.length === 0 || includeItemTypes.includes('movie');
        const wantsSeries = includeItemTypes.length === 0 || includeItemTypes.includes('series');
        const wantsEpisode = includeItemTypes.length === 0 || includeItemTypes.includes('episode');
        const perTypeLimit = limit + startIndex;

        if (!searchTerm) {
            return res.send({ SearchHints: [], TotalRecordCount: 0 });
        }

        const hints = [];
        let totalCount = 0;

        if (wantsMovie) {
            const where = { movieName: { [Op.like]: `%${searchTerm}%` } };
            const count = await Movie.count({ where });

            totalCount += count;
            const results = await Movie.findAll({
                where,
                limit: perTypeLimit,
                offset: startIndex,
                order: [['movieName', 'ASC']]
            });

            hints.push(...results.map(movie => toSearchHint(movie, 'movie')));
        }

        if (wantsSeries) {
            const where = { seriesName: { [Op.like]: `%${searchTerm}%` } };
            const count = await Series.count({ where });

            totalCount += count;
            const results = await Series.findAll({
                where,
                limit: perTypeLimit,
                offset: startIndex,
                order: [['seriesName', 'ASC']]
            });

            hints.push(...results.map(series => toSearchHint(series, 'series')));
        }

        if (wantsEpisode) {
            const where = { episodeName: { [Op.like]: `%${searchTerm}%` } };
            const count = await Episode.count({ where });

            totalCount += count;
            const results = await Episode.findAll({
                where,
                include: [Series],
                limit: perTypeLimit,
                offset: startIndex,
                order: [['episodeName', 'ASC']]
            });

            hints.push(...results.map(ep => toSearchHint(ep, 'episode')));
        }

        const sorted = hints.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
        const paged = sorted.slice(startIndex, startIndex + limit);

        return res.send({
            SearchHints: paged,
            TotalRecordCount: totalCount
        });
    });
};
