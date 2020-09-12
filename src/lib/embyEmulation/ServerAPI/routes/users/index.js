import {Movie} from '../../../../../models/movie';
import {TrackMovie} from '../../../../../models/trackMovie';
import {File} from '../../../../../models/file';

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
        let sessionToken = embyEmulation.handleLogin(req.params.Username, req.params.Wp);

        res.send({
            User: {
                Name: 'Robin',
                ServerId: embyEmulation.serverId,
                Id: sessionToken,
                HasPassword: true,
                HasConfiguredPassword: true,
                HasConfiguredEasyPassword: false,
                EnableAutoLogin: false,
                LastLoginDate: '2020-09-11T23:37:27.3042432Z',
                LastActivityDate: '2020-09-11T23:37:27.3042432Z'
            },
            SessionInfo: {},
            AccessToken: sessionToken,
            ServerId: embyEmulation.serverId
        });

        next();
    });

    server.get('/users/:userid', async (req, res, next) => {
        res.send({
            Name: 'Robin',
            ServerId: embyEmulation.serverId,
            Id: req.headers.emby.Token,
            HasPassword: true,
            HasConfiguredPassword: true,
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
                offset,
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
                    'ProductionYear': movie.releaseDate.substring(0,4),
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

            res.send({
                'Name': movie.movieName,
                'OriginalTitle': movie.movieName,
                'ServerId': embyEmulation.serverId,
                'Id': 'c042cd5ec05a53975b853b127bea567b',
                'Etag': '6448f9c5d2678db5ffa4de1c283f6e6a',
                'DateCreated': '2020-09-07T23:53:49.0000000Z',
                'CanDelete': false,
                'CanDownload': true,
                'HasSubtitles': true,
                'Container': 'mkv,webm',
                'SortName': movie.movieName,
                'PremiereDate': '2020-09-04T00:00:00.0000000Z',
                'ExternalUrls': [{'Name': 'IMDb', 'Url': 'https://www.imdb.com/title/tt4566758'}, {
                    'Name': 'TheMovieDb',
                    'Url': 'https://www.themoviedb.org/movie/337401'
                }, {'Name': 'Trakt', 'Url': 'https://trakt.tv/movies/tt4566758'}],
                'MediaSources': [{
                    'Protocol': 'File',
                    'Id': 'c042cd5ec05a53975b853b127bea567b',
                    'Path': '/media/Movies/Mulan.2020.1080p.DSNP.WEB-DL.DDP5.1.Atmos.H.264-PHOENiX.mkv',
                    'Type': 'Default',
                    'Container': 'mkv',
                    'Size': 7990969856,
                    'Name': 'Mulan.2020.1080p.DSNP.WEB-DL.DDP5.1.Atmos.H.264-PHOENiX',
                    'IsRemote': false,
                    'ETag': '313f5f26c5f6636a77c630468b6920f7',
                    'RunTimeTicks': 69087043584,
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
                }],
                'CriticRating': 82,
                'ProductionLocations': ['China', 'United States of America'],
                'Path': '/media/Movies/Mulan.2020.1080p.DSNP.WEB-DL.DDP5.1.Atmos.H.264-PHOENiX.mkv',
                'EnableMediaSourceDisplay': true,
                'OfficialRating': 'PG-13',
                'Overview': movie.overview,
                'Taglines': [],
                'Genres': ['Drama', 'Action', 'War', 'Fantasy', 'Adventure'],
                'CommunityRating': 2.6,
                'RunTimeTicks': 69087043584,
                'PlayAccess': 'Full',
                'ProductionYear': movie.releaseDate.substring(0,4),
                'RemoteTrailers': [{
                    'Url': 'https://www.youtube.com/watch?v=01ON04GCwKs',
                    'Name': 'Disney\'s Mulan - Official Teaser'
                }, {
                    'Url': 'https://www.youtube.com/watch?v=KK8FHdFluOQ',
                    'Name': 'Official Trailer'
                }, {
                    'Url': 'https://www.youtube.com/watch?v=R-eFm--k21c',
                    'Name': 'Final Trailer'
                }, {
                    'Url': 'https://www.youtube.com/watch?v=bJbAZh3fv0g',
                    'Name': 'Coming Sept. 4 | Mulan | Disney+'
                }, {'Url': 'https://www.youtube.com/watch?v=1UXZEGYSwgg', 'Name': 'Coming Sept. 4 | Mulan | Disney+'}],
                'ProviderIds': {'Tmdb': movie.tmdbid, 'Imdb': 'tt4566758'},
                'IsHD': true,
                'IsFolder': false,
                'ParentId': 'e675012a1892a87530d2c0b0d14a9026',
                'Type': 'Movie',
                'People': [{
                    'Name': 'Liu Yifei',
                    'Id': '1ca09f328295f709601936b4b01aeb7a',
                    'Role': 'Hua Mulan',
                    'Type': 'Actor',
                    //'PrimaryImageTag': '6842ed88ed28342419d73f4728ac0919',
                    'ImageBlurHashes': {
                        'Primary': {
                            '6842ed88ed28342419d73f4728ac0919': 'dNO.Hl?G~M-.0cay^hocKkWE$+jFW8R.%Lofn$WCxaxZ',
                            '65df873b3a22643475421e218331198d': 'dbE.FTxt0fRkxCWBR-s:9uWC$*aeNGoLt7WXM|f6xZae',
                            'a7888de4da0419a4aeb29b890c8ba29d': 'dZIqM;-pyE%g_NE1OYV[_3$*?HtRt-OX=|-px^sokBoz',
                            '3545cf180b0ab87bd64dfa9b90e0b842': 'dKEK.VE|0gfl^jS2RkNb5RS4={Nu$jE#$*ofwfNuxZso',
                            '92249b2b41ed1654a4cbfe4b5dfd5842': 'dnJj}KflAH%M4mV@R+R*tns:xDR+NHkCxaofE1WBslay',
                            '55f5c746c9de70c75fdf9f8e7f32096d': 'dQG[c+$~F|XT~9ob%M%00LW=w[r=IpWBn+M}kpV@-oxa',
                            '1527755c8217b60d86d07b98e086db26': 'd$M%yO?b_N.8?bRjWVfPI[ofa0j]-=t7oKjt%MWBRjj[',
                            '75fffe5d8b5aaa9486d9abad69e85516': 'dHD9#P4oD%Rjt7?bIUM{00of?bt7RjD%-;%MfQt7M{xu',
                            'c3015b3291d379d6f3a3f254eb6a54a0': 'drKnG4^+_Nxu_3t7x]ayRjV@aeofW=kCxZs:t7t7oMay',
                            'f603a118512275e0d94ab34aff40ed36': 'diG@oh-o0fE1-oxaWWNGW;WBoLjuRjWBt7WVofayazj[',
                            '4ce2b2347a45a90ad2891e8c1465f671': 'dZIzn.-p0#xtkVRjs:jZ0zIo%1WBo#ay%Lxat7NGxZoe',
                            '8d80d69d3dda9e433c0711a5b6a6a32b': 'dXH_3^^+%#tS_N%Mx^kW%gWU%1s9%NW;xZxGo~t7s:kC',
                            'b26cbb24e472b924e38e3ccfcc06b4a4': 'dvKA]0-;_N%N_3t7-;tR9aRjV@axt7t7s.oe%Mj]t7of',
                            'bd1c3930edac0b829681e88a5bfb5fa2': 'd^LD#{t7tm%M~Wjsf,t7S3ayV@WVtRt7ofof%Mj[kCof',
                            '0c58bb79156034e0de93f4713874c5d0': 'dbGa,.?Gx^S$~Vxa%MkWNHNGe.s:WVWCNGofozofxat7',
                            '1a1aa007152d100394c03d0a70f63c09': 'dPIO94~V0K0e^PR5%g_NS4xvxas.T0tRMxIAW=RkkDkC',
                            '1e181b88f4dd5920b3c1f9c7aff7ad42': 'dOEf7;_3OstR~W%N.8%gR*j@xut7X9RjD%RjIobHxat7',
                            '11f4efcd03eb1382e24a32e167d05e5b': 'dIC6+6g%5i%e~BnhE0t39Za0rsV@57Nf%3WsD%WAt7WX',
                            'fde226709c81b2b0cda370756f0edb19': 'dUEU.Y%M5RkE};t6EMR%IqWWadM|IqbHofWEs7oLbboe',
                            '84f4402f5ca71ffda5d8d9faf7629ae6': 'dSLMYQ%2.T%38bR+yWkqHsaK$fnipcXR%2oM.8s:Xloz',
                            '7c75e74526da5268f82fd72305cf8ce6': 'd+LWbM%MyE%M~Wt7x]t7ELRjxGjZIpays:s:tRoftRoz',
                            '6047b96a21478c5f62962277530fcafb': 'dZFE7h^k#Tv#}t$*rra0M{R*kCbHIoRjkWxuVsV@kCt7',
                            'e9ac59a0c9fd6432ab9a5cc9ad2d6df5': 'dXF#wHoz5nt6$ytRS$xu0eaxwHWBEiM_xZIUM{WAs:og',
                            '39f9e2cfd3db8d30c2f2fb3205caa6d7': 'dmJ7E#%20~NH4.RjaJWBo~W;-oxZIVofoKR*R*Rks:oL'
                        }
                    }
                }],
                'Studios': [{
                    'Name': 'Walt Disney Pictures',
                    'Id': 'ff966337d51b0e006da6e16df7cb7ca1'
                }, {
                    'Name': 'China Film Group Corporation',
                    'Id': 'cf7a1d58185a6a4372d0e4eeccd11f7e'
                }, {
                    'Name': 'Good Fear',
                    'Id': 'f6c01c4be8514f819d4aedd46b45c82f'
                }, {
                    'Name': 'Jason T. Reed Productions',
                    'Id': '20ad95596d5ecd2693f9124ec697b9ae'
                }, {'Name': 'Bioskopin21', 'Id': 'fb24bec0731b1af5991c7a3151aba2b6'}],
                'GenreItems': [{'Name': 'Drama', 'Id': '090eac6e9de4fe1fbc194e5b96691277'}, {
                    'Name': 'Action',
                    'Id': 'ce06903d834d2c3417e0889dd4049f3b'
                }, {'Name': 'War', 'Id': 'f8dbf7a2ab1427f4b038db28cd08f8ab'}, {
                    'Name': 'Fantasy',
                    'Id': 'a30dcc65be22eb3c21c03f7c1c7a57d1'
                }, {'Name': 'Adventure', 'Id': '51cec9645b896084d12b259acd05ccb1'}],
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
                'Height': 1080
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
};
