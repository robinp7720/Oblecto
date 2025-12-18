import { Movie } from '../../../../../models/movie';
import { TrackMovie } from '../../../../../models/trackMovie';
import { File } from '../../../../../models/file';
import { User } from '../../../../../models/user';
import { Stream } from '../../../../../models/stream';
import { createStreamsList, formatUuid, parseUuid } from '../../../helpers';
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

        res.send({
            'User':{
                'Name': 'robin',
                'ServerId':'e5ea18c5377547a2917f55a080fbb0e8',
                'Id': formatUuid(embyEmulation.sessions[sessionId].Id),
                'PrimaryImageTag':'d62dc9f98bfae3c2c8a1bbe092d94e1c',
                'HasPassword': true,
                'HasConfiguredPassword':true,
                'HasConfiguredEasyPassword':false,
                'EnableAutoLogin':false,
                'LastLoginDate':'2025-12-18T14:18:38.0847453Z',
                'LastActivityDate':'2025-12-18T14:18:38.0847453Z',
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
                'Id':'ee997eb90a1f2ed650ddab0f6d9c8b20',
                'UserId': formatUuid(embyEmulation.sessions[sessionId].Id),
                'UserName':'Robin',
                'Client':'Delfin',
                'LastActivityDate':'2025-12-18T14:18:38.0871101Z',
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
                'ServerId':'e5ea18c5377547a2917f55a080fbb0e8',
                'UserPrimaryImageTag':'d62dc9f98bfae3c2c8a1bbe092d94e1c',
                'SupportedCommands':[]
            },
            'AccessToken':'13959fd264f64aed9883955f5ca2735b',
            'ServerId':'e5ea18c5377547a2917f55a080fbb0e8'
        });
    });

    server.get('/users/:userid', async (req, res) => {
        let user = await User.findByPk(parseUuid(req.params.userid));

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
        if (req.params.includeitemtypes === 'movie') {
            let count = await Movie.count();

            let offset = parseInt(req.params.startindex) | 0;

            let results = await Movie.findAll({
                limit: parseInt(req.params.limit) || 100,
                offset
            });

            let items = [];

            for (let movie of results) {
                items.push({
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

                });
            }

            res.send({
                'Items': items,
                'TotalRecordCount': count,
                'StartIndex': offset
            });
        } else {
            res.send({
                Items: [],
                TotalRecordCount: 0,
                StartIndex: 0
            });
        }
    });

    server.get('/users/:userid/items/:mediaid', async (req, res) => {
        if (req.params.mediaid.includes('movie')) {
            let movie = await Movie.findByPk(req.params.mediaid.replace('movie', ''), {
                include: [
                    {
                        model: File,
                        include: [{ model: Stream }]
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

            res.send({
                'Name': movie.movieName,
                'OriginalTitle': movie.originalName,
                'ServerId': embyEmulation.serverId,
                'Id': 'movie' + movie.id,
                'Etag': '6448f9c5d2678db5ffa4de1c283f6e6a',
                'DateCreated': movie.createdAt,
                'CanDelete': false,
                'CanDownload': true,
                'HasSubtitles': true,
                'Container': 'mkv,webm',
                'SortName': movie.movieName,
                'PremiereDate': movie.releaseDate,
                'ExternalUrls': [
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
                ],
                'MediaSources': MediaSources,
                'CriticRating': 82,
                'ProductionLocations': ['China', 'United States of America'],
                'Path': movie.Files[0].path,
                'EnableMediaSourceDisplay': true,
                'OfficialRating': 'PG-13',
                'Overview': movie.overview,
                'Taglines': [movie.tagline],
                'Genres': movie.genres,
                'CommunityRating': 2.6,
                'RunTimeTicks': movie.runtime * 10000000,
                'PlayAccess': 'Full',
                'ProductionYear': movie.releaseDate.substring(0, 4),
                'RemoteTrailers': [],
                'ProviderIds': {
                    'Tmdb': movie.tmdbid,
                    'Imdb': movie.imdbid
                },
                'IsHD': true,
                'IsFolder': false,
                'ParentId': 'e675012a1892a87530d2c0b0d14a9026',
                'Type': 'Movie',
                'People': [],
                'Studios': [],
                'LocalTrailerCount': 0,
                'UserData': {
                    'PlaybackPositionTicks': 0,
                    'PlayCount': 0,
                    'IsFavorite': true,
                    'Played': false,
                    'Key': '337401'
                },
                'SpecialFeatureCount': 0,
                'DisplayPreferencesId': 'dbf7709c41faaa746463d67978eb863d',
                'Tags': [],
                'PrimaryImageAspectRatio': 0.6666666666666666,
                'ImageTags': { 'Primary': 'ThisIDisfairlyuseless' },
                'BackdropImageTags': ['be04a5eac7bc48ea3f5834aa816a03f0'],
                'VideoType': 'VideoFile',
                // 'ImageTags': {'Primary': 'eaaa9ab0189f4166db1012ec5230c7db'},
                // 'BackdropImageTags': ['be04a5eac7bc48ea3f5834aa816a03f0'],
                'ScreenshotImageTags': [],
                // 'ImageBlurHashes': {
                //    'Backdrop': {'be04a5eac7bc48ea3f5834aa816a03f0': 'W7D78hkBL};OCl}E}G,rI:65KOSxITWVx^K39tjG+]sBs;Sgadwd'},
                //    'Primary': {'eaaa9ab0189f4166db1012ec5230c7db': 'ddHoON-V.S%g~qxuxuniRPRjMxM{-;M{Rjoz%#Nasoxa'}
                // },
                'Chapters': [
                    {
                        'StartPositionTicks': 0,
                        'Name': 'Chapter 1',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 3000000000,
                        'Name': 'Chapter 2',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 6000000000,
                        'Name': 'Chapter 3',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 9000000000,
                        'Name': 'Chapter 4',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 12000000000,
                        'Name': 'Chapter 5',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 15000000000,
                        'Name': 'Chapter 6',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 18000000000,
                        'Name': 'Chapter 7',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 21000000000,
                        'Name': 'Chapter 8',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 24000000000,
                        'Name': 'Chapter 9',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 27000000000,
                        'Name': 'Chapter 10',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 30000000000,
                        'Name': 'Chapter 11',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 33000000000,
                        'Name': 'Chapter 12',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 36000000000,
                        'Name': 'Chapter 13',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 39000000000,
                        'Name': 'Chapter 14',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 42000000000,
                        'Name': 'Chapter 15',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 45000000000,
                        'Name': 'Chapter 16',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 48000000000,
                        'Name': 'Chapter 17',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 51000000000,
                        'Name': 'Chapter 18',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 54000000000,
                        'Name': 'Chapter 19',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 57000000000,
                        'Name': 'Chapter 20',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 60000000000,
                        'Name': 'Chapter 21',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 63000000000,
                        'Name': 'Chapter 22',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    },
                    {
                        'StartPositionTicks': 66000000000,
                        'Name': 'Chapter 23',
                        'ImageDateModified': '0001-01-01T00:00:00.0000000Z'
                    }
                ],
                'LocationType': 'FileSystem',
                'MediaType': 'Video',
                'LockedFields': [],
                'LockData': false,
                'Width': 1920,
                'Height': 1080
            });
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
