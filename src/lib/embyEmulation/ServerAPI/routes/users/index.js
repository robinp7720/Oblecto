import {Movie} from '../../../../../models/movie';
import {TrackMovie} from '../../../../../models/trackMovie';
import {File} from '../../../../../models/file';
import {User} from '../../../../../models/user';

/**
 * @param {*} server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.get('/users/public', async (req, res, next) => {
        res.send([]);

        next();
    });

    server.post('/users/authenticatebyname', async (req, res, next) => {
        let sessionId = await embyEmulation.handleLogin(req.params.Username, req.params.Pw);

        res.send({
            User: embyEmulation.sessions[sessionId],
            SessionInfo: {},
            AccessToken: sessionId,
            ServerId: embyEmulation.serverId
        });

        next();
    });

    server.get('/users/:userid', async (req, res, next) => {
        let user = await User.findByPk(req.params.userid);

        let HasPassword = user.password !== '';

        res.send({
            Name: user.name,
            ServerId: embyEmulation.serverId,
            Id: user.id,
            HasPassword,
            HasConfiguredPassword: HasPassword,
            HasConfiguredEasyPassword: false,
            EnableAutoLogin: false,
            LastLoginDate: '2020-09-11T23:37:27.3042432Z',
            LastActivityDate: '2020-09-11T23:37:27.3042432Z',
            'Policy': {
                'IsAdministrator': false,
                'IsHidden': true,
                'IsDisabled': false,
                'BlockedTags': [],
                'EnableUserPreferenceAccess': true,
                'AccessSchedules': [],
                'BlockUnratedItems': [],
                'EnableRemoteControlOfOtherUsers': false,
                'EnableSharedDeviceControl': true,
                'EnableRemoteAccess': true,
                'EnableLiveTvManagement': true,
                'EnableLiveTvAccess': true,
                'EnableMediaPlayback': true,
                'EnableAudioPlaybackTranscoding': true,
                'EnableVideoPlaybackTranscoding': true,
                'EnablePlaybackRemuxing': true,
                'ForceRemoteSourceTranscoding': false,
                'EnableContentDeletion': false,
                'EnableContentDeletionFromFolders': [],
                'EnableContentDownloading': true,
                'EnableSyncTranscoding': true,
                'EnableMediaConversion': true,
                'EnabledDevices': [],
                'EnableAllDevices': true,
                'EnabledChannels': [],
                'EnableAllChannels': false,
                'EnabledFolders': [],
                'EnableAllFolders': true,
                'InvalidLoginAttemptCount': 0,
                'LoginAttemptsBeforeLockout': -1,
                'EnablePublicSharing': true,
                'BlockedMediaFolders': [],
                'BlockedChannels': [],
                'RemoteClientBitrateLimit': 0,
                'AuthenticationProviderId': 'Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider',
                'PasswordResetProviderId': 'Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider',
                'SyncPlayAccess': 'CreateAndJoinGroups'
            },
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
            }
        });

        next();
    });

    server.get('/users/:userid/views', async (req, res, next) => {
        res.send({
            'Items': [{
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
                //'ImageTags': {'Primary': '8d5abf60711bc8af6ef4063baf6b67e4'},
                'BackdropImageTags': [],
                'ScreenshotImageTags': [],
                //'ImageBlurHashes': {'Primary': {'8d5abf60711bc8af6ef4063baf6b67e4': 'WvIE5t05-gs,RVt6a%s,axa#fRodETt0WGa#fha$Rot3WBj[oLaf'}},
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
                //'ImageTags': {'Primary': '12c129f756f9ae7ca28c3d87ac4aa3b5'},
                'BackdropImageTags': [],
                'ScreenshotImageTags': [],
                //'ImageBlurHashes': {'Primary': {'12c129f756f9ae7ca28c3d87ac4aa3b5': 'WrHeF9~X%gt7e-Rjs.WBoft7xutRR,t7s:aebHofoft7WBWBRjRj'}},
                'LocationType': 'FileSystem',
                'LockedFields': [],
                'LockData': false
            }], 'TotalRecordCount': 2, 'StartIndex': 0
        });

        next();
    });

    server.get('/users/:userid/items', async (req, res, next) => {
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
                    'RunTimeTicks': 69087043584,
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
                    'ImageTags': {
                        'Primary': 'WhyIsThisEvenNeeded'
                    }

                });
            }

            res.send({
                'Items': items, 'TotalRecordCount': count, 'StartIndex': offset
            });
        } else {
            res.send({
                Items: [],
                TotalRecordCount: 0,
                StartIndex: 0
            });
        }

        next();
    });

    server.get('/users/:userid/items/:mediaid', async (req, res, next) => {
        if (req.params.mediaid.includes('movie')) {
            let movie = await Movie.findByPk(req.params.mediaid.replace('movie', ''), {
                include: [
                    File
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
                    'Size': 7990969856,
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
                    'MediaStreams': [
                        {
                            'Codec': 'h264',
                            'Language': 'eng',
                            'ColorTransfer': 'bt709',
                            'ColorPrimaries': 'bt709',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '1001/48000',
                            'VideoRange': 'SDR',
                            'DisplayTitle': '1080p H264',
                            'NalLengthSize': '0',
                            'IsInterlaced': false,
                            'IsAVC': false,
                            'BitRate': 9253220,
                            'BitDepth': 8,
                            'RefFrames': 1,
                            'IsDefault': true,
                            'IsForced': false,
                            'Height': 1080,
                            'Width': 1920,
                            'AverageFrameRate': 23.976025,
                            'RealFrameRate': 23.976025,
                            'Profile': 'High',
                            'Type': 'Video',
                            'AspectRatio': '16:9',
                            'Index': 0,
                            'IsExternal': false,
                            'IsTextSubtitleStream': false,
                            'SupportsExternalStream': false,
                            'PixelFormat': 'yuv420p',
                            'Level': 40
                        },
                        {
                            'Codec': 'eac3',
                            'Language': 'eng',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '1/48000',
                            'Title': 'English',
                            'DisplayTitle': 'Eng Dolby Digital+ 6 ch Default',
                            'IsInterlaced': false,
                            'Channels': 6,
                            'SampleRate': 48000,
                            'IsDefault': true,
                            'IsForced': false,
                            'Type': 'Audio',
                            'Index': 1,
                            'IsExternal': false,
                            'IsTextSubtitleStream': false,
                            'SupportsExternalStream': false,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'eng',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'English',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'English - Default',
                            'IsInterlaced': false,
                            'IsDefault': true,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 2,
                            'Score': 112221,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'dan',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Danish',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Danish',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 3,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'ger',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'German',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'German',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 4,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'ger',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'German',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'German',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 5,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'spa',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Spanish',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Spanish',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 6,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'spa',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Spanish',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Spanish',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 7,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'spa',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Spanish',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Spanish',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 8,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'spa',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Spanish',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Spanish',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 9,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'fin',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Finnish',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Finnish',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 10,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'fre',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'French',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'French',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 11,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'fre',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'French',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'French',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 12,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'fre',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'French',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'French',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 13,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'fre',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'French',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'French',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 14,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'ita',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Italian',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Italian',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 15,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'ita',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Italian',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Italian',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 16,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'dut',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Dutch',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Dutch',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 17,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'nor',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Norwegian',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Norwegian',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 18,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'por',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Portuguese',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Portuguese',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 19,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'por',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Portuguese',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Portuguese',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 20,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'por',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Portuguese',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Portuguese',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 21,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'por',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Portuguese',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Portuguese',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 22,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        },
                        {
                            'Codec': 'subrip',
                            'Language': 'swe',
                            'TimeBase': '1/1000',
                            'CodecTimeBase': '0/1',
                            'Title': 'Swedish',
                            'localizedUndefined': 'Undefined',
                            'localizedDefault': 'Default',
                            'localizedForced': 'Forced',
                            'DisplayTitle': 'Swedish',
                            'IsInterlaced': false,
                            'IsDefault': false,
                            'IsForced': false,
                            'Type': 'Subtitle',
                            'Index': 23,
                            'IsExternal': false,
                            'IsTextSubtitleStream': true,
                            'SupportsExternalStream': true,
                            'Level': 0
                        }
                    ],
                    'MediaAttachments': [],
                    'Formats': [],
                    'Bitrate': 9253220,
                    'RequiredHttpHeaders': {},
                    'DefaultAudioStreamIndex': 1,
                    'DefaultSubtitleStreamIndex': 2,
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
                    {'Name': 'IMDb', 'Url': 'https://www.imdb.com/title/tt4566758'},
                    {'Name': 'TheMovieDb', 'Url': 'https://www.themoviedb.org/movie/337401'},
                    {'Name': 'Trakt', 'Url': 'https://trakt.tv/movies/tt4566758'}],
                'MediaSources': MediaSources,
                'CriticRating': 82,
                'ProductionLocations': ['China', 'United States of America'],
                'Path': movie.Files[0].path,
                'EnableMediaSourceDisplay': true,
                'OfficialRating': 'PG-13',
                'Overview': movie.overview,
                'Taglines': [movie.tagline],
                'Genres': ['Drama', 'Action', 'War', 'Fantasy', 'Adventure'],
                'CommunityRating': 2.6,
                'RunTimeTicks': movie.Files[0].duration * 10000000,
                'PlayAccess': 'Full',
                'ProductionYear': movie.releaseDate.substring(0, 4),
                'RemoteTrailers': [],
                'ProviderIds': {
                    'Tmdb': movie.tmdbid, 'Imdb': movie.imdbid
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
                'ImageTags': {
                    'Primary': 'ThisIDisfairlyuseless'
                },
                'BackdropImageTags': [
                    'be04a5eac7bc48ea3f5834aa816a03f0'
                ],
                'VideoType': 'VideoFile',
                //'ImageTags': {'Primary': 'eaaa9ab0189f4166db1012ec5230c7db'},
                //'BackdropImageTags': ['be04a5eac7bc48ea3f5834aa816a03f0'],
                'ScreenshotImageTags': [],
                //'ImageBlurHashes': {
                //    'Backdrop': {'be04a5eac7bc48ea3f5834aa816a03f0': 'W7D78hkBL};OCl}E}G,rI:65KOSxITWVx^K39tjG+]sBs;Sgadwd'},
                //    'Primary': {'eaaa9ab0189f4166db1012ec5230c7db': 'ddHoON-V.S%g~qxuxuniRPRjMxM{-;M{Rjoz%#Nasoxa'}
                //},
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
                'Height': 1080,
            });
        } else {
            res.send({
                Items: [],
                TotalRecordCount: 0,
                StartIndex: 0
            });
        }

        next();
    });

    server.get('/users/:userid/items/:mediaid/intros', async (req, res, next) => {
        res.send({'Items': [], 'TotalRecordCount': 0, 'StartIndex': 0});
        next();
    });

    server.get('/users/:userid/items/resume', async (req, res, next) => {
        res.send({'Items': [], 'TotalRecordCount': 0, 'StartIndex': 0});
        next();
    });

    server.get('/users/:userid/items/latest', async (req, res, next) => {
        res.send({'Items': [], 'TotalRecordCount': 0, 'StartIndex': 0});
        next();
    });
};
