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
            LastActivityDate: '2020-09-11T23:37:27.3042432Z'
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
                    'MediaStreams': [],
                    'MediaAttachments': [],
                    'Formats': [],
                    'Bitrate': 9253220,
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
                'MediaStreams': [],
                'VideoType': 'VideoFile',
                //'ImageTags': {'Primary': 'eaaa9ab0189f4166db1012ec5230c7db'},
                //'BackdropImageTags': ['be04a5eac7bc48ea3f5834aa816a03f0'],
                'ScreenshotImageTags': [],
                //'ImageBlurHashes': {
                //    'Backdrop': {'be04a5eac7bc48ea3f5834aa816a03f0': 'W7D78hkBL};OCl}E}G,rI:65KOSxITWVx^K39tjG+]sBs;Sgadwd'},
                //    'Primary': {'eaaa9ab0189f4166db1012ec5230c7db': 'ddHoON-V.S%g~qxuxuniRPRjMxM{-;M{Rjoz%#Nasoxa'}
                //},
                'Chapters': [],
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
