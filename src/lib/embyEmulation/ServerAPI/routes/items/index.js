import {Movie} from '../../../../../models/movie';
import {File} from '../../../../../models/file';
import fs from 'fs';
import errors from 'restify-errors';

/**
 *
 * @param server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.get('/items', async (req, res, next) => {
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
                        'Primary': 'eaaa9ab0189f4166db1012ec5230c7db'
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


    server.get('/items/:mediaid/similar', async (req, res, next) => {
        res.send({
            Items: [],
            TotalRecordCount: 0,
            StartIndex: 0
        });

        next();
    });

    server.get('/items/:mediaid/thememedia', async (req, res, next) => {
        res.send({
            'ThemeVideosResult': {
                //'OwnerId': 'f27caa37e5142225cceded48f6553502',
                'Items': [],
                'TotalRecordCount': 0,
                'StartIndex': 0
            },
            'ThemeSongsResult': {
                //'OwnerId': 'f27caa37e5142225cceded48f6553502',
                'Items': [],
                'TotalRecordCount': 0,
                'StartIndex': 0
            },
            'SoundtrackSongsResult': {'Items': [], 'TotalRecordCount': 0, 'StartIndex': 0}
        });

        next();
    });

    server.get('/items/:mediaid/images/primary', async (req, res, next) => {
        let mediaid = req.params.mediaid;

        if (mediaid.includes('movie')) {
            let movie = await Movie.findByPk(mediaid.replace('movie', ''), {
                include: [File]
            });

            let posterPath = embyEmulation.oblecto.artworkUtils.moviePosterPath(movie, 'medium');

            fs.createReadStream(posterPath)
                .on('error', () => {
                    return next(new errors.NotFoundError('Poster for movie does not exist'));
                })
                .pipe(res);

        }

        next();
    });

    server.get('/items/:mediaid/images/backdrop/:artworkid', async (req, res, next) => {
        let mediaid = req.params.mediaid;

        if (mediaid.includes('movie')) {
            let movie = await Movie.findByPk(mediaid.replace('movie', ''), {
                include: [File]
            });

            let posterPath = embyEmulation.oblecto.artworkUtils.movieFanartPath(movie, 'large');

            fs.createReadStream(posterPath)
                .on('error', () => {
                    return next(new errors.NotFoundError('Poster for movie does not exist'));
                })
                .pipe(res);

        }

        next();
    });

    server.post('/items/:mediaid/playbackinfo', async (req, res, next) => {
        let mediaid = req.params.mediaid;

        let files = [];

        if (mediaid.includes('movie')) {
            let movie = await Movie.findByPk(mediaid.replace('movie', ''), {
                include: [File]
            });

            files = movie.Files;

        }

        let MediaSources = [];

        for (let file of files) {
            MediaSources.push({
                'Protocol': 'File',
                'Id': file.id,
                'Path': file.path,
                'Type': 'Default',
                'Container': 'mp4',
                'Size': 7990969856,
                'Name': file.name,
                'IsRemote': false,
                'ETag': '313f5f26c5f6636a77c630468b6920f7',
                'RunTimeTicks': file.duration * 10000000,
                'ReadAtNativeFramerate': true,
                'IgnoreDts': false,
                'IgnoreIndex': false,
                'GenPtsInput': false,
                'SupportsTranscoding': false,
                'SupportsDirectStream': true,
                'SupportsDirectPlay': true,
                'IsInfiniteStream': false,
                'RequiresOpening': false,
                'RequiresClosing': false,
                'RequiresLooping': false,
                'SupportsProbing': true,
                'VideoType': 'VideoFile',
                'MediaStreams': [{
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
                }, {
                    'Codec': 'aac',
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
                }],
                'MediaAttachments': [],
                'Formats': [],
                'Bitrate': 9253220,
                'RequiredHttpHeaders': {},
                //'TranscodingUrl': '/videos/c042cd5e-c05a-5397-5b85-3b127bea567b/master.m3u8?DeviceId=TW96aWxsYS81LjAgKFgxMTsgTGludXggeDg2XzY0OyBydjo4Mi4wKSBHZWNrby8yMDEwMDEwMSBGaXJlZm94LzgyLjB8MTU5OTg2NDM5ODY2Mg11&MediaSourceId=c042cd5ec05a53975b853b127bea567b&VideoCodec=h264&AudioCodec=mp3,aac&AudioStreamIndex=1&VideoBitrate=139616000&AudioBitrate=384000&PlaySessionId=c89d3c1e027b4463b59bcd06e183679f&api_key=28eece16e48a4bb997e2137297d36321&TranscodingMaxAudioChannels=2&RequireAvc=false&Tag=313f5f26c5f6636a77c630468b6920f7&SegmentContainer=ts&MinSegments=1&BreakOnNonKeyFrames=True&h264-profile=high,main,baseline,constrainedbaseline&h264-level=51&h264-deinterlace=true&TranscodeReasons=VideoCodecNotSupported',
                //'TranscodingSubProtocol': 'hls',
                //'TranscodingContainer': 'ts',
                'DefaultAudioStreamIndex': 1,
                'DefaultSubtitleStreamIndex': 2
            });
        }

        res.send({
            MediaSources, 'PlaySessionId': req.headers.emby.Token
        });

        next();
    });

};
