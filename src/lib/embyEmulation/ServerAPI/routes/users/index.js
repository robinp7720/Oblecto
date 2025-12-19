import { Movie } from '../../../../../models/movie';
import { TrackMovie } from '../../../../../models/trackMovie';
import { File } from '../../../../../models/file';
import { User } from '../../../../../models/user';
import { Stream } from '../../../../../models/stream';
import { createStreamsList, formatUuid, parseUuid, parseId, formatMediaItem } from '../../../helpers';
import { Series } from '../../../../../models/series';
import logger from '../../../../../submodules/logger';

/**
 * @param {*} server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.get('/users/public', async (req, res) => {
        res.send([]);
    });

    server.post('/users/authenticatebyname', async (req, res) => {
        let sessionId = await embyEmulation.handleLogin(req.body.Username, req.body.Pw);

        logger.debug('Jellyfin Session ID: ' + sessionId);
        logger.debug(embyEmulation.sessions[sessionId]);

        const session = embyEmulation.sessions[sessionId];

        res.send({
            'User':{
                'Name': session.Name,
                'ServerId': session.ServerId,
                'Id': formatUuid(session.Id),
                'PrimaryImageTag':'d62dc9f98bfae3c2c8a1bbe092d94e1c',
                'HasPassword': session.HasPassword,
                'HasConfiguredPassword': session.HasConfiguredPassword,
                'HasConfiguredEasyPassword': session.HasConfiguredEasyPassword,
                'EnableAutoLogin': session.EnableAutoLogin,
                'LastLoginDate': session.LastLoginDate,
                'LastActivityDate': session.LastActivityDate,
                'Configuration':{
                    'AudioLanguagePreference':'','PlayDefaultAudioTrack':true,'SubtitleLanguagePreference':'','DisplayMissingEpisodes':false,'GroupedFolders':[],'SubtitleMode':'Default','DisplayCollectionsView':false,'EnableLocalPassword':true,'OrderedViews':['9d7ad6afe9afa2dab1a2f6e00ad28fa6','f137a2dd21bbc1b99aa5c0f6bf02a805','a656b907eb3a73532e40e44b968d0225'],'LatestItemsExcludes':[],'MyMediaExcludes':[],'HidePlayedInLatest':false,'RememberAudioSelections':true,'RememberSubtitleSelections':true,'EnableNextEpisodeAutoPlay':true,'CastReceiverId':'F007D354'
                },
                'Policy':{
                    'IsAdministrator':true,'IsHidden':false,'EnableCollectionManagement':true,'EnableSubtitleManagement':true,'EnableLyricManagement':false,'IsDisabled':false,'BlockedTags':[],'AllowedTags':[],'EnableUserPreferenceAccess':true,'AccessSchedules':[],'BlockUnratedItems':[],'EnableRemoteControlOfOtherUsers':true,'EnableSharedDeviceControl':true,'EnableRemoteAccess':true,'EnableLiveTvManagement':true,'EnableLiveTvAccess':true,'EnableMediaPlayback':true,'EnableAudioPlaybackTranscoding':true,'EnableVideoPlaybackTranscoding':true,'EnablePlaybackRemuxing':true,'ForceRemoteSourceTranscoding':false,'EnableContentDeletion':true,'EnableContentDeletionFromFolders':[],'EnableContentDownloading':true,'EnableSyncTranscoding':true,'EnableMediaConversion':true,'EnabledDevices':[],'EnableAllDevices':true,'EnabledChannels':[],'EnableAllChannels':true,'EnabledFolders':[],'EnableAllFolders':true,'InvalidLoginAttemptCount':0,'LoginAttemptsBeforeLockout':-1,'MaxActiveSessions':0,'EnablePublicSharing':true,'BlockedMediaFolders':[],'BlockedChannels':[],'RemoteClientBitrateLimit':0,'AuthenticationProviderId':'Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider','PasswordResetProviderId':'Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider','SyncPlayAccess':'CreateAndJoinGroups'
                }
            },
            'SessionInfo':{
                'PlayState':{
                    'CanSeek':false,'IsPaused':false,'IsMuted':false,'RepeatMode':'RepeatNone','PlaybackOrder':'Default'
                },
                'AdditionalUsers':[],
                'Capabilities':{
                    'PlayableMediaTypes':[],'SupportedCommands':[],'SupportsMediaControl':false,'SupportsPersistentIdentifier':true
                },
                'RemoteEndPoint':'192.168.176.206',
                'PlayableMediaTypes':[],
                'Id': sessionId,
                'UserId': formatUuid(session.Id),
                'UserName': session.Name,
                'Client':'Delfin',
                'LastActivityDate': session.LastActivityDate,
                'LastPlaybackCheckIn':'0001-01-01T00:00:00.0000000Z',
                'DeviceName':'tria',
                'DeviceId':'d0ecd4d3-8e3d-4c1b-add4-0d1e1dd24794',
                'ApplicationVersion':'0.4.8',
                'IsActive':true,
                'SupportsMediaControl':false,
                'SupportsRemoteControl':false,
                'NowPlayingQueue':[],
                'NowPlayingQueueFullItems':[],
                'HasCustomDeviceName':false,
                'ServerId': session.ServerId,
                'UserPrimaryImageTag':'d62dc9f98bfae3c2c8a1bbe092d94e1c',
                'SupportedCommands':[]
            },
            'AccessToken': sessionId,
            'ServerId': session.ServerId
        });
    });

    server.get('/users/:userid', async (req, res) => {
        // let user = await User.findByPk(parseUuid(req.params.userid));
        let user = await User.findByPk(1);

        let HasPassword = user.password !== '';

        res.send({
            Name: user.name,
            ServerId: embyEmulation.serverId,
            Id: formatUuid(user.id),
            HasPassword,
            HasConfiguredPassword: HasPassword,
            HasConfiguredEasyPassword: false,
            EnableAutoLogin: false,
            LastLoginDate: '2020-09-11T23:37:27.3042432Z',
            LastActivityDate: '2020-09-11T23:37:27.3042432Z',
            'Configuration': {
                'PlayDefaultAudioTrack': true,
                'SubtitleLanguagePreference': '',
                'DisplayMissingEpisodes': false,
                'GroupedFolders': [],
                'SubtitleMode': 'Default',
                'DisplayCollectionsView': false,
                'EnableLocalPassword': false,
                'OrderedViews': [],
                'LatestItemsExcludes': [],
                'MyMediaExcludes': [],
                'HidePlayedInLatest': true,
                'RememberAudioSelections': true,
                'RememberSubtitleSelections': true,
                'EnableNextEpisodeAutoPlay': true
            },
            'Policy': {
                'IsAdministrator': true,
                'IsHidden': true,
                'IsDisabled': false,
                'BlockedTags': [],
                'EnableUserPreferenceAccess': true,
                'AccessSchedules': [],
                'BlockUnratedItems': [],
                'EnableRemoteControlOfOtherUsers': false,
                'EnableSharedDeviceControl': false,
                'EnableRemoteAccess': false,
                'EnableLiveTvManagement': false,
                'EnableLiveTvAccess': false,
                'EnableMediaPlayback': true,
                'EnableAudioPlaybackTranscoding': false,
                'EnableVideoPlaybackTranscoding': false,
                'EnablePlaybackRemuxing': true,
                'ForceRemoteSourceTranscoding': false,
                'EnableContentDeletion': true,
                'EnableContentDeletionFromFolders': [],
                'EnableContentDownloading': true,
                'EnableSyncTranscoding': false,
                'EnableMediaConversion': false,
                'EnabledDevices': [],
                'EnableAllDevices': true,
                'EnabledChannels': [],
                'EnableAllChannels': true,
                'EnabledFolders': [],
                'EnableAllFolders': true,
                'InvalidLoginAttemptCount': 0,
                'LoginAttemptsBeforeLockout': -1,
                'MaxActiveSessions': 0,
                'EnablePublicSharing': true,
                'BlockedMediaFolders': [],
                'BlockedChannels': [],
                'RemoteClientBitrateLimit': 0,
                'AuthenticationProviderId': 'Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider',
                'PasswordResetProviderId': 'Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider',
                'SyncPlayAccess': 'CreateAndJoinGroups'
            }
        });
    });

    server.get('/users/:userid/views', async (req, res) => {
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

    server.get('/users/:userid/items', async (req, res) => {
        console.log(req.query);

        const includeItemTypes = req.query.includeitemtypes;
        const parentId = req.query.ParentId || req.query.parentId || '';
        const sortBy = req.query.SortBy || req.query.sortBy || 'DateCreated';
        const sortOrder = req.query.SortOrder || req.query.sortOrder || 'Descending';
        const limit = parseInt(req.query.Limit || req.query.limit) || 100;
        const startIndex = parseInt(req.query.StartIndex || req.query.startIndex) || 0;
        const userId = 1; // parseUuid(req.params.userid);

        // Handle Sorting
        let orderDirection = sortOrder.toLowerCase() === 'ascending' ? 'ASC' : 'DESC';
        let order = [];
        const sortFields = sortBy.split(',');

        for (const field of sortFields) {
            if (field === 'DateCreated') {
                order.push(['createdAt', orderDirection]);
            } else if (field === 'SortName') {
                order.push(['movieName', orderDirection]);
            } else if (field === 'ProductionYear') {
                order.push(['releaseDate', orderDirection]);
            }
        }

        logger.debug(includeItemTypes);

        if (includeItemTypes.toLowerCase().includes('movie')) {
            let queryOptions = {
                include: [
                    {
                        model: TrackMovie,
                        required: false,
                        where: { userId: userId }
                    },
                    { model: File }
                ],
                limit: limit,
                offset: startIndex
            };

            if (order.length > 0) {
                queryOptions.order = order;
            }

            let count = await Movie.count();

            let results = await Movie.findAll(queryOptions);

            let items = results.map(movie => formatMediaItem(movie, 'movie', embyEmulation));

            res.send({
                'Items': items,
                'TotalRecordCount': count,
                'StartIndex': startIndex
            });
        } else if (includeItemTypes.toLowerCase().includes('series') || parentId === 'a656b907eb3a73532e40e44b968d0225') {
            // For series, we might need different sorting fields (e.g. seriesName instead of movieName)
            // Re-map sort fields for Series
            let seriesOrder = [];

            for (const field of sortFields) {
                if (field === 'DateCreated') {
                    seriesOrder.push(['createdAt', orderDirection]);
                } else if (field === 'SortName') {
                    seriesOrder.push(['seriesName', orderDirection]);
                } else if (field === 'ProductionYear') {
                    seriesOrder.push(['firstAired', orderDirection]);
                }
            }

            let queryOptions = {
                include: [
                    // Series doesn't have TrackMovie, logic for Series tracking is likely different or not fully implemented here yet in the same way
                    // But we should include Files if possible? Series connects to Files via Episodes generally.
                    // Checking existing code, Series.findAll is usually just called.
                ],
                limit: limit,
                offset: startIndex
            };

            if (seriesOrder.length > 0) {
                queryOptions.order = seriesOrder;
            }

            let count = await Series.count();
            let results = await Series.findAll(queryOptions);
            let items = results.map(series => formatMediaItem(series, 'series', embyEmulation));

            res.send({
                'Items': items,
                'TotalRecordCount': count,
                'StartIndex': startIndex
            });

        } else {
            res.send({
                Items: [],
                TotalRecordCount: 0,
                StartIndex: startIndex
            });
        }
    });

    server.get('/users/:userid/items/:mediaid', async (req, res) => {
        const { id, type } = parseId(req.params.mediaid);

        if (type === 'movie') {
            let movie = await Movie.findByPk(id, {
                include: [
                    {
                        model: File,
                        include: [{ model: Stream }]
                    },
                    {
                        model: TrackMovie,
                        required: false,
                        where: { userId: parseUuid(req.params.userid) }
                    }
                ]
            });

            let MediaSources = [];

            for (let file of movie.Files) {

                MediaSources.push({
                    'Protocol': 'File',
                    'Id': file.id,
                    'Path': file.path,
                    'Type': 'Default',
                    'Container': file.container,
                    'Size': file.size,
                    'Name': file.name,
                    'IsRemote': false,
                    'ETag': '313f5f26c5f6636a77c630468b6920f7',
                    'RunTimeTicks': file.duration * 10000000,
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
                    'MediaStreams': createStreamsList(file.Streams),
                    'MediaAttachments': [],
                    'Formats': [],
                    'Bitrate': file.size / file.duration,
                    'RequiredHttpHeaders': {},
                    'DefaultAudioStreamIndex': 1,
                    'DefaultSubtitleStreamIndex': 2
                });
            }

            const item = formatMediaItem(movie, 'movie', embyEmulation);

            item.OriginalTitle = movie.originalName;
            item.Etag = '6448f9c5d2678db5ffa4de1c283f6e6a';
            item.DateCreated = movie.createdAt;
            item.CanDelete = false;
            item.CanDownload = true;
            item.SortName = movie.movieName;
            item.ExternalUrls = [
                {
                    'Name': 'IMDb',
                    'Url': `https://www.imdb.com/title/${movie.imdbid}`
                },
                {
                    'Name': 'TheMovieDb',
                    'Url': `https://www.themoviedb.org/movie/${movie.tmdbid}`
                },
                {
                    'Name': 'Trakt',
                    'Url': `https://trakt.tv/movies/${movie.imdbid}`
                }
            ];
            item.MediaSources = MediaSources;
            item.ProductionLocations = ['China', 'United States of America'];
            item.EnableMediaSourceDisplay = true;
            item.Overview = movie.overview;
            item.Taglines = [movie.tagline];
            item.Genres = movie.genres;
            item.PlayAccess = 'Full';
            item.RemoteTrailers = [];
            item.ProviderIds = {
                'Tmdb': movie.tmdbid,
                'Imdb': movie.imdbid
            };
            item.IsHD = true;
            item.ParentId = 'e675012a1892a87530d2c0b0d14a9026';
            item.People = [];
            item.Studios = [];
            item.LocalTrailerCount = 0;
            item.SpecialFeatureCount = 0;
            item.DisplayPreferencesId = 'dbf7709c41faaa746463d67978eb863d';
            item.Tags = [];
            item.Chapters = [
                {
                    'StartPositionTicks': 0,
                    'Name': 'Chapter 1',
                    'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                }
            ];
            item.LockedFields = [];
            item.LockData = false;
            item.Width = 1920;
            item.Height = 1080;

            res.send(item);
        } else {
            res.send({
                Items: [],
                TotalRecordCount: 0,
                StartIndex: 0
            });
        }
    });

    server.get('/users/:userid/items/:mediaid/intros', async (req, res) => {
        res.send({
            'Items': [],
            'TotalRecordCount': 0,
            'StartIndex': 0
        });
    });

    server.get('/users/:userid/items/resume', async (req, res) => {
        res.send({
            'Items': [],
            'TotalRecordCount': 0,
            'StartIndex': 0
        });
    });

    server.get('/users/:userid/items/latest', async (req, res) => {
        if (req.params.parentid === 'movies') {
            let results = await Movie.findAll({
                include: [
                    {
                        model: TrackMovie,
                        required: false,
                        where: { userId: embyEmulation.sessions[req.headers.emby.Token].Id }
                    }
                ],
                order: [['releaseDate', 'DESC']],
                limit: 50,
                offset: 0
            });

            let movies = results.map((movie) => {
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
                    'RunTimeTicks': movie.runtime * 10000000,
                    'ProductionYear': movie.releaseDate.substring(0, 4),
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

        if (req.params.parentid === 'shows') {
            let results = await Series.findAll({
                include: [
                    {
                        model: TrackMovie,
                        required: false,
                        where: { userId: embyEmulation.sessions[req.headers.emby.Token].Id }
                    }
                ],
                order: [['firstAired', 'DESC']],
                limit: 50,
                offset: 0
            });

            let series = results.map((show) => {
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
    });
};
