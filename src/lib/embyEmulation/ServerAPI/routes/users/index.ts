/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unused-vars, @typescript-eslint/prefer-nullish-coalescing */
import { Movie } from '../../../../../models/movie';
import { TrackMovie } from '../../../../../models/trackMovie';
import { File } from '../../../../../models/file';
import { User } from '../../../../../models/user';
import { Stream } from '../../../../../models/stream';
import { formatUuid, parseUuid, parseId, formatMediaItem, formatId, MediaItem } from '../../../helpers';
import { Series } from '../../../../../models/series';
import { Episode } from '../../../../../models/episode';
import { TrackEpisode } from '../../../../../models/trackEpisode';
import logger from '../../../../../submodules/logger/index.js';
import { Op } from 'sequelize';

import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';
import { EmbyRequest } from '../../index.js';
import { getRequestValue } from '../../requestUtils.js';

const buildUserDto = (user: User, embyEmulation: EmbyEmulation): Record<string, unknown> => {
    const HasPassword = user.password !== '';

    return {
        Name: user.name,
        ServerId: embyEmulation.serverId,
        Id: formatUuid(user.id),
        PrimaryImageTag: 'd62dc9f98bfae3c2c8a1bbe092d94e1c',
        HasPassword,
        HasConfiguredPassword: HasPassword,
        HasConfiguredEasyPassword: false,
        EnableAutoLogin: false,
        LastLoginDate: '2020-09-11T23:37:27.3042432Z',
        LastActivityDate: '2020-09-11T23:37:27.3042432Z',
        Configuration: {
            PlayDefaultAudioTrack: true,
            SubtitleLanguagePreference: '',
            DisplayMissingEpisodes: false,
            GroupedFolders: [],
            SubtitleMode: 'Default',
            DisplayCollectionsView: false,
            EnableLocalPassword: false,
            OrderedViews: [],
            LatestItemsExcludes: [],
            MyMediaExcludes: [],
            HidePlayedInLatest: true,
            RememberAudioSelections: true,
            RememberSubtitleSelections: true,
            EnableNextEpisodeAutoPlay: true
        },
        Policy: {
            IsAdministrator: true,
            IsHidden: false,
            IsDisabled: false,
            BlockedTags: [],
            EnableUserPreferenceAccess: true,
            AccessSchedules: [],
            BlockUnratedItems: [],
            EnableRemoteControlOfOtherUsers: false,
            EnableSharedDeviceControl: false,
            EnableRemoteAccess: false,
            EnableLiveTvManagement: false,
            EnableLiveTvAccess: false,
            EnableMediaPlayback: true,
            EnableAudioPlaybackTranscoding: false,
            EnableVideoPlaybackTranscoding: false,
            EnablePlaybackRemuxing: true,
            ForceRemoteSourceTranscoding: false,
            EnableContentDeletion: true,
            EnableContentDeletionFromFolders: [],
            EnableContentDownloading: true,
            EnableSyncTranscoding: false,
            EnableMediaConversion: false,
            EnabledDevices: [],
            EnableAllDevices: true,
            EnabledChannels: [],
            EnableAllChannels: true,
            EnabledFolders: [],
            EnableAllFolders: true,
            InvalidLoginAttemptCount: 0,
            LoginAttemptsBeforeLockout: -1,
            MaxActiveSessions: 0,
            EnablePublicSharing: true,
            BlockedMediaFolders: [],
            BlockedChannels: [],
            RemoteClientBitrateLimit: 0,
            AuthenticationProviderId: 'Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider',
            PasswordResetProviderId: 'Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider',
            SyncPlayAccess: 'CreateAndJoinGroups'
        }
    };
};

/**
 *
 * @param server - The Express application
 * @param embyEmulation - The EmbyEmulation instance
 */
export default (server: Application, embyEmulation: EmbyEmulation): void => {
    server.get('/users/public', (req: Request, res: Response) => {
        res.send([]);
    });

    server.get('/users', async (req: Request, res: Response) => {
        const users = await User.findAll();

        res.send(users.map((user) => buildUserDto(user, embyEmulation)));
    });

    server.post('/users/authenticatebyname', async (req: EmbyRequest, res: Response) => {
        const Username = getRequestValue(req, 'Username');
        const Pw = getRequestValue(req, 'Pw');

        if (!Username || !Pw) {
            res.status(400).send('Missing Username or Pw');
            return;
        }

        const sessionId = await embyEmulation.handleLogin(Username, Pw);

        logger.debug('Jellyfin Session ID: ' + sessionId);
        logger.debug(JSON.stringify(embyEmulation.sessions[sessionId]));

        const session = embyEmulation.sessions[sessionId];

        res.send({
            'User': {
                'Name': session.Name,
                'ServerId': session.ServerId,
                'Id': formatUuid(session.Id),
                'PrimaryImageTag': 'd62dc9f98bfae3c2c8a1bbe092d94e1c',
                'HasPassword': session.HasPassword,
                'HasConfiguredPassword': session.HasConfiguredPassword,
                'HasConfiguredEasyPassword': session.HasConfiguredEasyPassword,
                'EnableAutoLogin': session.EnableAutoLogin,
                'LastLoginDate': session.LastLoginDate,
                'LastActivityDate': session.LastActivityDate,
                'Configuration': {
                    'AudioLanguagePreference': '', 'PlayDefaultAudioTrack': true, 'SubtitleLanguagePreference': '', 'DisplayMissingEpisodes': false, 'GroupedFolders': [], 'SubtitleMode': 'Default', 'DisplayCollectionsView': false, 'EnableLocalPassword': true, 'OrderedViews': ['9d7ad6afe9afa2dab1a2f6e00ad28fa6', 'f137a2dd21bbc1b99aa5c0f6bf02a805', 'a656b907eb3a73532e40e44b968d0225'], 'LatestItemsExcludes': [], 'MyMediaExcludes': [], 'HidePlayedInLatest': false, 'RememberAudioSelections': true, 'RememberSubtitleSelections': true, 'EnableNextEpisodeAutoPlay': true, 'CastReceiverId': 'F007D354'
                },
                'Policy': {
                    'IsAdministrator': true, 'IsHidden': false, 'EnableCollectionManagement': true, 'EnableSubtitleManagement': true, 'EnableLyricManagement': false, 'IsDisabled': false, 'BlockedTags': [], 'AllowedTags': [], 'EnableUserPreferenceAccess': true, 'AccessSchedules': [], 'BlockUnratedItems': [], 'EnableRemoteControlOfOtherUsers': true, 'EnableSharedDeviceControl': true, 'EnableRemoteAccess': true, 'EnableLiveTvManagement': true, 'EnableLiveTvAccess': true, 'EnableMediaPlayback': true, 'EnableAudioPlaybackTranscoding': true, 'EnableVideoPlaybackTranscoding': true, 'EnablePlaybackRemuxing': true, 'ForceRemoteSourceTranscoding': false, 'EnableContentDeletion': true, 'EnableContentDeletionFromFolders': [], 'EnableContentDownloading': true, 'EnableSyncTranscoding': true, 'EnableMediaConversion': true, 'EnabledDevices': [], 'EnableAllDevices': true, 'EnabledChannels': [], 'EnableAllChannels': true, 'EnabledFolders': [], 'EnableAllFolders': true, 'InvalidLoginAttemptCount': 0, 'LoginAttemptsBeforeLockout': -1, 'MaxActiveSessions': 0, 'EnablePublicSharing': true, 'BlockedMediaFolders': [], 'BlockedChannels': [], 'RemoteClientBitrateLimit': 0, 'AuthenticationProviderId': 'Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider', 'PasswordResetProviderId': 'Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider', 'SyncPlayAccess': 'CreateAndJoinGroups'
                }
            },
            'SessionInfo': {
                'PlayState': {
                    'CanSeek': false, 'IsPaused': false, 'IsMuted': false, 'RepeatMode': 'RepeatNone', 'PlaybackOrder': 'Default'
                },
                'AdditionalUsers': [],
                'Capabilities': {
                    'PlayableMediaTypes': [], 'SupportedCommands': [], 'SupportsMediaControl': false, 'SupportsPersistentIdentifier': true
                },
                'RemoteEndPoint': '192.168.176.206',
                'PlayableMediaTypes': [],
                'Id': sessionId,
                'UserId': formatUuid(session.Id),
                'UserName': session.Name,
                'Client': 'Delfin',
                'LastActivityDate': session.LastActivityDate,
                'LastPlaybackCheckIn': '0001-01-01T00:00:00.0000000Z',
                'DeviceName': 'tria',
                'DeviceId': 'd0ecd4d3-8e3d-4c1b-add4-0d1e1dd24794',
                'ApplicationVersion': '0.4.8',
                'IsActive': true,
                'SupportsMediaControl': false,
                'SupportsRemoteControl': false,
                'NowPlayingQueue': [],
                'NowPlayingQueueFullItems': [],
                'HasCustomDeviceName': false,
                'ServerId': session.ServerId,
                'UserPrimaryImageTag': 'd62dc9f98bfae3c2c8a1bbe092d94e1c',
                'SupportedCommands': []
            },
            'AccessToken': sessionId,
            'ServerId': session.ServerId
        });
    });

    server.get('/users/:userid', async (req: Request, res: Response) => {
        // let user = await User.findByPk(parseUuid(req.query.userid));
        const user = await User.findByPk(1);

        if (!user) {
            res.status(404).send('User not found');
            return;
        }

        res.send(buildUserDto(user, embyEmulation));
    });

    server.get('/users/:userid/views', (req: Request, res: Response) => {
        res.send({
            'Items': [
                {
                    'Name': 'Movies',
                    'ServerId': embyEmulation.serverId,
                    'Id': 'f137a2dd21bbc1b99aa5c0f6bf02a805',
                    'Etag': 'cf36c1cd9bcd03c80bd92c9570ec620b',
                    'DateCreated': '2020-08-31T16:25:53.2124461Z',
                    'CanDelete': false,
                    'CanDownload': false,
                    'SortName': 'movies',
                    'ExternalUrls': [],
                    'Path': '/config/data/root/default/Movies',
                    'EnableMediaSourceDisplay': true,
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
                        'Key': 'f137a2dd-21bb-c1b9-9aa5-c0f6bf02a805'
                    },
                    'ChildCount': 2,
                    'SpecialFeatureCount': 0,
                    'DisplayPreferencesId': 'f137a2dd21bbc1b99aa5c0f6bf02a805',
                    'Tags': [],
                    'PrimaryImageAspectRatio': 1,
                    'CollectionType': 'movies',
                    // 'ImageTags': {'Primary': '8d5abf60711bc8af6ef4063baf6b67e4'},
                    'BackdropImageTags': [],
                    'ScreenshotImageTags': [],
                    // 'ImageBlurHashes': {'Primary': {'8d5abf60711bc8af6ef4063baf6b67e4': 'WvIE5t05-gs,RVt6a%s,axa#fRodETt0WGa#fha$Rot3WBj[oLaf'}},
                    'LocationType': 'FileSystem',
                    'LockedFields': [],
                    'LockData': false
                }, {
                    'Name': 'TV Shows',
                    'ServerId': embyEmulation.serverId,
                    'Id': '767bffe4f11c93ef34b805451a696a4e',
                    'Etag': '838cbe93f5d829a9df3df680e4d14065',
                    'DateCreated': '2020-08-31T04:36:37.8321784Z',
                    'CanDelete': false,
                    'CanDownload': false,
                    'SortName': 'tv shows',
                    'ExternalUrls': [],
                    'Path': '/config/data/root/default/TV Shows',
                    'EnableMediaSourceDisplay': true,
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
                        'Key': '767bffe4-f11c-93ef-34b8-05451a696a4e'
                    },
                    'ChildCount': 9,
                    'SpecialFeatureCount': 0,
                    'DisplayPreferencesId': '767bffe4f11c93ef34b805451a696a4e',
                    'Tags': [],
                    'PrimaryImageAspectRatio': 1,
                    'CollectionType': 'tvshows',
                    // 'ImageTags': {'Primary': '12c129f756f9ae7ca28c3d87ac4aa3b5'},
                    'BackdropImageTags': [],
                    'ScreenshotImageTags': [],
                    // 'ImageBlurHashes': {'Primary': {'12c129f756f9ae7ca28c3d87ac4aa3b5': 'WrHeF9~X%gt7e-Rjs.WBoft7xutRR,t7s:aebHofoft7WBWBRjRj'}},
                    'LocationType': 'FileSystem',
                    'LockedFields': [],
                    'LockData': false
                }
            ],
            'TotalRecordCount': 2,
            'StartIndex': 0
        });
    });

    server.get('/users/:userid/items', async (req: EmbyRequest, res: Response) => {
        let items = [];
        const normalizeQueryList = (query: Record<string, any>, ...keys: string[]): string[] => {
            const values: any[] = [];

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
        const includeItemTypes = normalizeQueryList(req.query as Record<string, any>, 'IncludeItemTypes', 'includeItemTypes', 'includeitemtypes')
            .map(value => value.toLowerCase());
        const searchTerm = getRequestValue(req, 'SearchTerm') || '';
        const startIndex = parseInt(getRequestValue(req, 'StartIndex') || '0', 10) || 0;
        const limit = parseInt(getRequestValue(req, 'Limit') || '100', 10) || 100;
        const parentId = getRequestValue(req, 'ParentId') || '';

        let parsedParentId = null;

        if (parentId) {
            parsedParentId = parseId(parentId);
        }

        if (includeItemTypes.includes('movie')) {
            const count = await Movie.count();

            let where: any = {};

            if (searchTerm) {
                where = { movieName: { [Op.like]: `%${searchTerm}%` } };
            }

            const results = await Movie.findAll({
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
        } else if (includeItemTypes.includes('series')) {
            const count = await Series.count();

            let where: any = {};

            if (searchTerm) {
                where = { seriesName: { [Op.like]: `%${searchTerm}%` } };
            }

            const sortBy = normalizeQueryList(req.query as Record<string, any>, 'SortBy', 'sortBy', 'sortby')
                .map(value => value.toLowerCase())
                .join(',');
            const sortOrder = normalizeQueryList(req.query as Record<string, any>, 'SortOrder', 'sortOrder', 'sortorder')
                .map(value => value.toLowerCase())
                .join(',') || 'ascending';
            const order: any[] = [];

            if (sortBy) {
                const parts = sortBy.split(',');

                for (const part of parts) {
                    const direction = sortOrder.startsWith('desc') ? 'DESC' : 'ASC';

                    if (part === 'sortname') {
                        order.push(['seriesName', direction]);
                    } else if (part === 'premieredate' || part === 'productionyear') {
                        order.push(['firstAired', direction]);
                    } else if (part === 'datecreated') {
                        order.push(['createdAt', direction]);
                    }
                }
            }

            if (order.length === 0) {
                order.push(['seriesName', 'ASC']);
            }

            const results = await Series.findAll({
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
        } else if (includeItemTypes.includes('episode') || (parsedParentId?.type === 'season')) {
            const userId = req.params.userid; // Route parameter
            const parsedUserId = userId ? parseUuid(userId) : null;
            const where: any = {};

            if (parsedParentId) {
                if (parsedParentId.type === 'series') {
                    where.SeriesId = parsedParentId.id;
                } else if (parsedParentId.type === 'season') {
                    where.SeriesId = Math.floor(parsedParentId.id / 1000);
                    where.airedSeason = parsedParentId.id % 1000;
                }
            }

            if (searchTerm) {
                where.episodeName = { [Op.like]: `%${searchTerm}%` };
            }

            const count = await Episode.count({ where });

            const include = [Series, { model: File, include: [{ model: Stream }] }];

            if (parsedUserId) {
                include.push({
                    model: TrackEpisode,
                    required: false,
                    where: { userId: parsedUserId }
                } as any);
            }

            const results = await Episode.findAll({
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
        } else if (includeItemTypes.includes('season') || (parsedParentId?.type === 'series')) {
            let seriesId = null;

            if (parsedParentId?.type === 'series') {
                seriesId = parsedParentId.id;
            }

            if (!seriesId) {
                return res.send({
                    Items: [], TotalRecordCount: 0, StartIndex: 0
                });
            }

            const series = await Series.findByPk(seriesId);

            if (!series) {
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
            const sortedSeasons = Array.from(distinctSeasons).sort((a: any, b: any) => Number(a) - Number(b));

            const pagedSeasons = sortedSeasons.slice(startIndex, startIndex + limit);

            for (const seasonNum of pagedSeasons as any[]) {
                const pseudoId = seriesId * 1000 + parseInt(String(seasonNum), 10);
                const seasonObj: MediaItem = {
                    id: pseudoId,
                    seasonName: 'Season ' + seasonNum,
                    seriesName: series.seriesName,
                    SeriesId: seriesId,
                    indexNumber: Number(seasonNum)
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

    server.get('/users/:userid/items/:mediaid', async (req: EmbyRequest, res: Response) => {
        const parsed = parseId(req.params.mediaid);
        const numericId = parsed.id;
        const userId = parseUuid(req.params.userid);
        let resolvedType = parsed.type;
        let item = null;

        const resolveMovie = async (movieId: number | string): Promise<Movie | null> => Movie.findByPk(movieId, {
            include: [
                {
                    model: File,
                    include: [{ model: Stream }]
                },
                {
                    model: TrackMovie,
                    required: false,
                    where: { userId: userId }
                }
            ]
        });

        const resolveEpisode = async (episodeId: number | string): Promise<Episode | null> => Episode.findByPk(episodeId, {
            include: [
                { model: Series },
                {
                    model: File,
                    include: [{ model: Stream }]
                },
                {
                    model: TrackEpisode,
                    required: false,
                    where: { userId: userId }
                }
            ]
        });

        const resolveSeries = async (seriesId: number | string): Promise<Series | null> => Series.findByPk(seriesId);

        if (resolvedType === 'movie' && Number.isFinite(numericId)) {
            item = await resolveMovie(numericId);
        } else if (resolvedType === 'series' && Number.isFinite(numericId)) {
            item = await resolveSeries(numericId);
        } else if (resolvedType === 'episode' && Number.isFinite(numericId)) {
            item = await resolveEpisode(numericId);
        } else if (resolvedType === 'season' && Number.isFinite(numericId)) {
            const seriesId = Math.floor(numericId / 1000);
            const seasonNum = numericId % 1000;
            const series = await Series.findByPk(seriesId);

            item = {
                id: numericId,
                seasonName: 'Season ' + seasonNum,
                seriesName: series ? series.seriesName : null,
                SeriesId: seriesId,
                indexNumber: seasonNum
            };
        }

        if (!item && Number.isFinite(numericId)) {
            item = await resolveMovie(numericId);
            if (item) {
                resolvedType = 'movie';
            } else {
                item = await resolveEpisode(numericId);
                if (item) {
                    resolvedType = 'episode';
                } else {
                    item = await resolveSeries(numericId);
                    if (item) {
                        resolvedType = 'series';
                    }
                }
            }
        }

        if (item) {
            // Special handling for Movie to include detailed media sources if needed,
            // but formatMediaItem handles basic properties.
            // The previous implementation for Movie manually constructed MediaSources.
            // formatMediaItem is simpler.
            // Let's rely on formatMediaItem to be consistent with /items/:mediaid
            // However, the previous implementation injected a LOT of extra fields for Movie.
            // If I replace it entirely with formatMediaItem, I might lose those fields (ExternalUrls, etc).
            // But consistency is better. The previous implementation had hardcoded "MediaSources" loop.
            // I should stick to formatMediaItem but maybe enhance it if needed.

            // Actually, for Movie, the previous code returned a very rich object.
            // For now, I will use formatMediaItem for ALL types to solve the "loading" issue for Series.
            // If Movie details regress, I can revisit.

            res.send(formatMediaItem(item, resolvedType, embyEmulation));
        } else {
            res.status(404).send('Item not found');
        }
    });

    server.get('/users/:userid/items/:mediaid/intros', (req, res) => {
        res.send({
            'Items': [],
            'TotalRecordCount': 0,
            'StartIndex': 0
        });
    });

    server.get('/users/:userid/items/resume', (req, res) => {
        res.send({
            'Items': [],
            'TotalRecordCount': 0,
            'StartIndex': 0
        });
    });

    const getLatestItems = async (req: EmbyRequest, res: Response): Promise<void> => {
        const parentId = getRequestValue(req, 'ParentId');

        if (parentId === 'movies') {
            const results = await Movie.findAll({
                /* include: [
                    {
                        model: TrackMovie,
                        required: false,
                        where: { userId: embyEmulation.sessions[req.headers.emby.Token].Id }
                    }
                ],*/
                order: [['releaseDate', 'DESC']],
                limit: 50,
                offset: 0
            });

            const movies = results.map((movie) => {
                return {
                    'Name': movie.movieName,
                    'ServerId': embyEmulation.serverId,
                    'Id': 'movie' + movie.id,
                    'HasSubtitles': true,
                    'Container': 'mkv,webm',
                    'PremiereDate': movie.releaseDate,
                    'CriticRating': 82,
                    'OfficialRating': 'PG-13',
                    'CommunityRating': 2.6,
                    'RunTimeTicks': (movie.runtime || 0) * 10000000,
                    'ProductionYear': (movie.releaseDate || '').substring(0, 4),
                    'IsFolder': false,
                    'Type': 'Movie',
                    'PrimaryImageAspectRatio': 0.6666666666666666,
                    'VideoType': 'VideoFile',
                    'LocationType': 'FileSystem',
                    'MediaType': 'Video',
                    'UserData': {
                        'PlaybackPositionTicks': 0,
                        'PlayCount': 0,
                        'IsFavorite': true,
                        'Played': false,
                        'Key': '337401'
                    },
                    'ImageTags': { 'Primary': 'WhyIsThisEvenNeeded' }

                };
            });

            res.send(movies);
        }

        if (parentId === 'shows') {
            const results = await Series.findAll({
                /* include: [
                    {
                        model: TrackMovie,
                        required: false,
                        where: { userId: embyEmulation.sessions[req.headers.emby.Token].Id }
                    }
                ],*/
                order: [['firstAired', 'DESC']],
                limit: 50,
                offset: 0
            });

            const series = results.map((show) => {
                return {
                    'Name': show.seriesName,
                    'ServerId': embyEmulation.serverId,
                    'Id': 'series' + show.id,
                    'PremiereDate': show.firstAired,
                    // 'Path': '/family_series/WeCrashed',
                    'OfficialRating': show.rating,
                    'ChannelId': null,
                    'CommunityRating': show.siteRating,
                    'RunTimeTicks': 0,
                    'ProductionYear': 2022,
                    'IsFolder': true,
                    'Type': 'Series',
                    'UserData': {
                        'UnplayedItemCount': 4,
                        'PlaybackPositionTicks': 0,
                        'PlayCount': 0,
                        'IsFavorite': false,
                        'Played': false,
                        'Key': '393499',
                        'ItemId': '00000000000000000000000000000000'
                    },
                    'ChildCount': 8,
                    'Status': show.status,
                    'AirDays': [],
                    'PrimaryImageAspectRatio': 0.6666666666666666,
                    'ImageTags': {
                        'Primary': '687b9e86c50b8d8ee6e3ade59f98f679',
                        'Thumb': '89f4741c490314f9e9cbee489c61067c'
                    },
                    'BackdropImageTags': ['5dc42ac73670938f5fc63cc6ad6b5b81'],
                    'ImageBlurHashes': {
                        'Backdrop': { '5dc42ac73670938f5fc63cc6ad6b5b81': 'WH8;=O4mtSxbE1-;%hS%oJWBWXx]IU.8M_Rk%NMxOZxvM{oft8M|' },
                        'Primary': { '687b9e86c50b8d8ee6e3ade59f98f679': 'd77B$VRjwcD%$jxCacS3yFoeR4Ri*0IVn$ofVsIAozxu' },
                        'Thumb': { '89f4741c490314f9e9cbee489c61067c': 'WcI4;OWBo|xZD%xZ~qs.I:ozROsm-;nhR*W?M{WE?aRPf+oyM{t7' }
                    },
                    'LocationType': 'FileSystem',
                    'MediaType': 'Unknown',
                    'EndDate': '2022-04-22T00:00:00.0000000Z'
                };
            });

            res.send(series);
        }
    };

    server.get('/users/:userid/items/latest', getLatestItems as any);
    server.get('/items/latest', getLatestItems as any);

    server.get('/useritems/resume', (req, res) => {
        res.send({
            'Items': [],
            'TotalRecordCount': 0,
            'StartIndex': 0
        });
    });

    // TODO: Implement Auth routes
    server.get('/auth/keys', (req, res) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.post('/auth/keys', (req, res) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.delete('/auth/keys/:key', (req, res) => {
        // TODO: Implement
        res.status(501).send('Not Implemented');
    });

    server.get('/auth/passwordresetproviders', (req, res) => {
        // TODO: Implement
        res.send([]); // Return empty list for now
    });

    server.get('/auth/providers', (req, res) => {
        // TODO: Implement
        res.send([]); // Return empty list for now
    });

    // Additional User Routes
    server.get('/users/:userid/policy', (req, res) => { res.send({}); });
    server.post('/users/authenticatewithquickconnect', (req, res) => { res.status(501).send('Not Implemented'); });
    server.get('/users/configuration', (req, res) => { res.send([]); });
    server.post('/users/forgotpassword', (req, res) => { res.status(501).send('Not Implemented'); });
    server.post('/users/forgotpassword/pin', (req, res) => { res.status(501).send('Not Implemented'); });
    server.get('/users/me', (req, res) => { res.status(401).send('Unauthorized'); }); // Needs auth middleware
    server.post('/users/new', (req, res) => { res.status(501).send('Not Implemented'); });
    server.post('/users/password', (req, res) => { res.status(501).send('Not Implemented'); });

    // UserImage
    server.get('/userimage', (req, res) => { res.status(404).send('Not Found'); }); // This seems to be POST in some docs or GET specific image? Spec says GET /UserImage (truncated?)

    // UserItems
    server.get('/useritems/:itemid/userdata', (req, res) => { res.send({}); });
    server.post('/useritems/:itemid/rating', (req, res) => { res.send({}); });

    // UserPlayedItems
    server.post('/userplayeditems/:itemid', (req, res) => { res.send({}); });
    server.delete('/userplayeditems/:itemid', (req, res) => { res.send({}); });

    // UserFavoriteItems
    server.post('/userfavoriteitems/:itemid', (req, res) => { res.send({}); });
    server.delete('/userfavoriteitems/:itemid', (req, res) => { res.send({}); });

    // UserViews
    server.get('/userviews/groupingoptions', (req, res) => { res.send([]); });
};