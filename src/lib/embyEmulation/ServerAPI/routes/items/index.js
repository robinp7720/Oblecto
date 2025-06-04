import { Movie } from '../../../../../models/movie';
import { File } from '../../../../../models/file';
import { promises as fs } from 'fs';
import errors from 'restify-errors';
import { createStreamsList } from '../../../helpers';
import { Stream } from '../../../../../models/stream';
import { Op } from 'sequelize';
import { Series } from '../../../../../models/series';

/**
 *
 * @param server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.get('/items', async (req, res) => {
        let items = [];

        if (req.params.includeitemtypes === 'movie') {
            let count = await Movie.count();

            let offset = parseInt(req.params.startindex) | 0;

            let where = null;

            if (req.params.searchterm) {
                where = { movieName: { [Op.like]: `%${req.params.searchterm}%` } };
            }

            let results = await Movie.findAll({
                where,
                limit: parseInt(req.params.limit) || 100,
                offset
            });

            for (let movie of results) {
                items.push({
                    'Name': movie.movieName,
                    'ServerId': embyEmulation.serverId,
                    'Id': 'movie' + movie.id,
                    'HasSubtitles': false,
                    'Container': 'mkv,webm',
                    'PremiereDate': movie.releaseDate,
                    'CriticRating': 82,
                    'OfficialRating': 'PG-13',
                    'CommunityRating': 2.6,
                    'RunTimeTicks': movie.runtime * 100000000,
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
                    'ImageTags': { 'Primary': 'eaaa9ab0189f4166db1012ec5230c7db' }
                });
            }

            res.send({
                'Items': items,
                'TotalRecordCount': count,
                'StartIndex': offset
            });
        } else if (req.params.includeitemtypes === 'series') {
            let count = await Series.count();

            let offset = parseInt(req.params.startindex) | 0;

            let where = null;

            if (req.params.searchterm) {
                where = { seriesName: { [Op.like]: `%${req.params.searchterm}%` } };
            }

            let results = await Series.findAll({
                where,
                limit: parseInt(req.params.limit) || 100,
                offset
            });

            for (let series of results) {
                items.push({
                    'Name': series.seriesName,
                    'ServerId': '70301c9fe99e4304bd5c8922b0e2fd90',
                    'Id': `series${series.id}`,
                    'PremiereDate': series.firstAired,
                    'OfficialRating': 'TV-14',
                    'ChannelId': null,
                    'CommunityRating': series.popularity,
                    'RunTimeTicks': series.runtime * 100000000,
                    'ProductionYear': series.firstAired.substring(0, 4),
                    'IsFolder': true,
                    'Type': 'Series',
                    'UserData': {
                        'UnplayedItemCount': 13,
                        'PlaybackPositionTicks': 0,
                        'PlayCount': 0,
                        'IsFavorite': false,
                        'Played': false,
                        'Key': '272644'
                    },
                    'Status': series.status,
                    'AirDays': [series.airsDayOfWeek],
                    'PrimaryImageAspectRatio': 0.6666666666666666,
                    'ImageTags': { 'Primary': 'd4ded7fd31f038b434148a4e162e031d' },
                    'BackdropImageTags': ['64e8f381684663b6a7f0d2c1cac61d08'],
                    'ImageBlurHashes': {
                        'Backdrop': { '64e8f381684663b6a7f0d2c1cac61d08': 'WU7xLXWARPt8V?f,%jRhROt7V?fmx_RiRiogackCtTaxaykCackC' },
                        'Primary': { 'd4ded7fd31f038b434148a4e162e031d': 'd23[JJxG9rW=;LbHS$sT*^n%Tfn$TfW:aIniX:bIRhbb' }
                    },
                    'LocationType': 'FileSystem',
                    'EndDate': null
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
                // 'OwnerId': 'f27caa37e5142225cceded48f6553502',
                'Items': [],
                'TotalRecordCount': 0,
                'StartIndex': 0
            },
            'ThemeSongsResult': {
                // 'OwnerId': 'f27caa37e5142225cceded48f6553502',
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
        let mediaid = req.params.mediaid;

        if (mediaid.includes('movie')) {
            let movie = await Movie.findByPk(mediaid.replace('movie', ''), { include: [File] });

            let posterPath = embyEmulation.oblecto.artworkUtils.moviePosterPath(movie, 'medium');

            res.sendRaw(await fs.readFile(posterPath));
        }

        if (mediaid.includes('series')) {
            let series = await Series.findByPk(mediaid.replace('series', ''), { include: [File] });

            let posterPath = embyEmulation.oblecto.artworkUtils.moviePosterPath(series, 'medium');

            res.sendRaw(await fs.readFile(posterPath));
        }
    });

    server.get('/items/:mediaid/images/backdrop/:artworkid', async (req, res) => {
        let mediaid = req.params.mediaid;

        if (mediaid.includes('movie')) {
            let movie = await Movie.findByPk(mediaid.replace('movie', ''), { include: [File] });

            let posterPath = embyEmulation.oblecto.artworkUtils.movieFanartPath(movie, 'large');

            res.sendRaw(await fs.readFile(posterPath));
        }

        if (mediaid.includes('series')) {
            let series = await Movie.findByPk(mediaid.replace('series', ''), { include: [File] });

            let posterPath = embyEmulation.oblecto.artworkUtils.movieFanartPath(series, 'large');

            res.sendRaw(await fs.readFile(posterPath));
        }
    });

    server.post('/items/:mediaid/playbackinfo', async (req, res) => {
        let mediaid = req.params.mediaid;

        let files = [];

        if (mediaid.includes('movie')) {
            let movie = await Movie.findByPk(req.params.mediaid.replace('movie', ''), {
                include: [
                    {
                        model: File,
                        include: [{ model: Stream }]
                    }
                ]
            });

            files = movie.Files;
        } else if (mediaid.includes('series')) {
            let series = await Series.findByPk(req.params.mediaid.replace('series', ''), {
                include: [
                    {
                        model: File,
                        include: [{ model: Stream }]
                    }
                ]
            });

            files = series.Files;
        }

        let file = files[0];

        if (req.params.MediaSourceId) {
            for (file of files) {
                if (file.id === req.params.MediaSourceId) {
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
            'MediaSources': files.map((file) => {
                return {
                    'Protocol': 'File',
                    'Id': file.id,
                    'Path': file.path,
                    'Type': 'Default',
                    'Container': 'mkv',
                    'Size': file.size,
                    'Name': file.name,
                    'IsRemote': false,
                    'ETag': '3670b404eb5adec1d6cd73868ad1801c',
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
                };
            }),
            'PlaySessionId': streamSession.sessionId
        });

        console.log('playback info complete');
    });

    server.get('/userviews', async (req, res) => {
        const userId = req.query.UserId;

        res.send(
            {
                'Items': [{
                    'Name': 'Collections',
                    'ServerId': 'e5ea18c5377547a2917f55a080fbb0e8',
                    'Id': '9d7ad6afe9afa2dab1a2f6e00ad28fa6',
                    'Etag': '9d9a6bcb23102727c1d544301964d049',
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
                    'ServerId': 'e5ea18c5377547a2917f55a080fbb0e8',
                    'Id': 'f137a2dd21bbc1b99aa5c0f6bf02a805',
                    'Etag': '9ceaa0eae0a3baea68127e1daf6135e9',
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
                    'ServerId': 'e5ea18c5377547a2917f55a080fbb0e8',
                    'Id': 'a656b907eb3a73532e40e44b968d0225',
                    'Etag': '4663f1b0e0aae9863ecf3205354f2c98',
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
                }, {
                    'Name': 'Books',
                    'ServerId': 'e5ea18c5377547a2917f55a080fbb0e8',
                    'Id': '4e985111ed7f570b595204d82adb02f3',
                    'Etag': '3b17d5ae849447a789f15bce49df39b9',
                    'DateCreated': '2024-09-22T19:56:14.3742268Z',
                    'CanDelete': false,
                    'CanDownload': false,
                    'SortName': 'books',
                    'ExternalUrls': [],
                    'Path': '/var/lib/jellyfin/root/default/Books',
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
                        'Key': '4e985111-ed7f-570b-5952-04d82adb02f3',
                        'ItemId': '00000000000000000000000000000000'
                    },
                    'ChildCount': 3,
                    'SpecialFeatureCount': 0,
                    'DisplayPreferencesId': '4e985111ed7f570b595204d82adb02f3',
                    'Tags': [],
                    'PrimaryImageAspectRatio': 1.7777777777777777,
                    'CollectionType': 'books',
                    'ImageTags': { 'Primary': '0dca742642c816dc43f1204064323692' },
                    'BackdropImageTags': [],
                    'ImageBlurHashes': { 'Primary': { '0dca742642c816dc43f1204064323692': 'W9C?DprrIBtRozfk?]RPWCRjxuWUE1X6?vxbNGbaxvozoft8RPV@' } },
                    'LocationType': 'FileSystem',
                    'MediaType': 'Unknown',
                    'LockedFields': [],
                    'LockData': false
                }, {
                    'Name': 'Home Videos and Photos',
                    'ServerId': 'e5ea18c5377547a2917f55a080fbb0e8',
                    'Id': 'ee75511ae395034b1e7e657707b15125',
                    'Etag': 'a8b3b8c373d2b3bd6eabe55b3099f9de',
                    'DateCreated': '2024-09-22T19:58:58.0775336Z',
                    'CanDelete': false,
                    'CanDownload': false,
                    'SortName': 'home videos and photos',
                    'ExternalUrls': [],
                    'Path': '/var/lib/jellyfin/root/default/Home Videos and Photos',
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
                        'Key': 'ee75511a-e395-034b-1e7e-657707b15125',
                        'ItemId': '00000000000000000000000000000000'
                    },
                    'ChildCount': 1,
                    'SpecialFeatureCount': 0,
                    'DisplayPreferencesId': 'ee75511ae395034b1e7e657707b15125',
                    'Tags': [],
                    'PrimaryImageAspectRatio': 1.7777777777777777,
                    'CollectionType': 'homevideos',
                    'ImageTags': { 'Primary': '04dfcbba8987566f33202643337b564f' },
                    'BackdropImageTags': [],
                    'ImageBlurHashes': { 'Primary': { '04dfcbba8987566f33202643337b564f': 'W69%;n4TIAtSITtS-;E1%MW;RPt74nNIROR%xuWAxujbM{e:tRRi' } },
                    'LocationType': 'FileSystem',
                    'MediaType': 'Unknown',
                    'LockedFields': [],
                    'LockData': false
                }, {
                    'Name': 'Live TV',
                    'ServerId': 'e5ea18c5377547a2917f55a080fbb0e8',
                    'Id': '2b2bca16aacc8a14d53a11bb829eafa5',
                    'Etag': 'baa25b36f7077a3a31001eab4ecaf7a4',
                    'DateCreated': '2024-01-12T13:10:44.8612916Z',
                    'CanDelete': false,
                    'CanDownload': false,
                    'SortName': 'live tv',
                    'ForcedSortName': 'Live TV',
                    'ExternalUrls': [],
                    'Path': '/var/lib/jellyfin/metadata/views/livetv',
                    'EnableMediaSourceDisplay': true,
                    'ChannelId': null,
                    'Taglines': [],
                    'Genres': [],
                    'PlayAccess': 'Full',
                    'RemoteTrailers': [],
                    'ProviderIds': {},
                    'IsFolder': true,
                    'ParentId': null,
                    'Type': 'UserView',
                    'People': [],
                    'Studios': [],
                    'GenreItems': [],
                    'LocalTrailerCount': 0,
                    'UserData': {
                        'PlaybackPositionTicks': 0,
                        'PlayCount': 0,
                        'IsFavorite': false,
                        'Played': false,
                        'Key': '2b2bca16-aacc-8a14-d53a-11bb829eafa5',
                        'ItemId': '00000000000000000000000000000000'
                    },
                    'ChildCount': 5,
                    'SpecialFeatureCount': 0,
                    'DisplayPreferencesId': 'cb46bc72e78d95cc6cd072de3a65b93a',
                    'Tags': [],
                    'CollectionType': 'livetv',
                    'ImageTags': {},
                    'BackdropImageTags': [],
                    'ImageBlurHashes': {},
                    'LocationType': 'FileSystem',
                    'MediaType': 'Unknown',
                    'LockedFields': [],
                    'LockData': false
                }, {
                    'Name': 'Music',
                    'ServerId': 'e5ea18c5377547a2917f55a080fbb0e8',
                    'Id': '7e64e319657a9516ec78490da03edccb',
                    'Etag': '74d6da2cfc22e984d59a3e8bb2b2c36e',
                    'DateCreated': '2024-09-22T20:13:18.8331527Z',
                    'CanDelete': false,
                    'CanDownload': false,
                    'SortName': 'music',
                    'ExternalUrls': [],
                    'Path': '/var/lib/jellyfin/root/default/Music',
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
                        'Key': '7e64e319-657a-9516-ec78-490da03edccb',
                        'ItemId': '00000000000000000000000000000000'
                    },
                    'ChildCount': 9,
                    'SpecialFeatureCount': 0,
                    'DisplayPreferencesId': '7e64e319657a9516ec78490da03edccb',
                    'Tags': [],
                    'PrimaryImageAspectRatio': 1.7777777777777777,
                    'CollectionType': 'music',
                    'ImageTags': { 'Primary': 'a8663760010a1b02dc87930a615acf39' },
                    'BackdropImageTags': [],
                    'ImageBlurHashes': { 'Primary': { 'a8663760010a1b02dc87930a615acf39': 'W97KxVof4nWB%MofbHayWBayj[j[00WB_3s:IUWBM{ayt7ofWBae' } },
                    'LocationType': 'FileSystem',
                    'MediaType': 'Unknown',
                    'LockedFields': [],
                    'LockData': false
                }, {
                    'Name': 'Playlists',
                    'ServerId': 'e5ea18c5377547a2917f55a080fbb0e8',
                    'Id': '4169778d5ae03ab20224e1c4594b5010',
                    'Etag': '28e0e5f47b5f617ad4e3268c1f6ecc9c',
                    'DateCreated': '2024-04-17T13:31:13.9667491Z',
                    'CanDelete': false,
                    'CanDownload': false,
                    'SortName': 'playlists',
                    'ExternalUrls': [],
                    'Path': '/var/lib/jellyfin/metadata/views/4169778d5ae03ab20224e1c4594b5010',
                    'EnableMediaSourceDisplay': true,
                    'ChannelId': null,
                    'Taglines': [],
                    'Genres': [],
                    'PlayAccess': 'Full',
                    'RemoteTrailers': [],
                    'ProviderIds': {},
                    'IsFolder': true,
                    'ParentId': null,
                    'Type': 'UserView',
                    'People': [],
                    'Studios': [],
                    'GenreItems': [],
                    'LocalTrailerCount': 0,
                    'UserData': {
                        'PlaybackPositionTicks': 0,
                        'PlayCount': 0,
                        'IsFavorite': false,
                        'Played': false,
                        'Key': '4169778d-5ae0-3ab2-0224-e1c4594b5010',
                        'ItemId': '00000000000000000000000000000000'
                    },
                    'ChildCount': 5,
                    'SpecialFeatureCount': 0,
                    'DisplayPreferencesId': 'cb46bc72e78d95cc6cd072de3a65b93a',
                    'Tags': [],
                    'PrimaryImageAspectRatio': 1.7777777777777777,
                    'CollectionType': 'playlists',
                    'ImageTags': { 'Primary': '19bd805c37e8f3aa1c79358ab91ddd4b' },
                    'BackdropImageTags': [],
                    'ImageBlurHashes': { 'Primary': { '19bd805c37e8f3aa1c79358ab91ddd4b': 'WA9HY0fk9FRjM_of.SayayWBWBj@00oL?at7smj[9Ej@oft7ofkC' } },
                    'LocationType': 'FileSystem',
                    'MediaType': 'Unknown',
                    'LockedFields': [],
                    'LockData': false
                }],
                'TotalRecordCount': 8,
                'StartIndex': 0
            }
        );
    });
};
