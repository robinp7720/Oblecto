import { Movie } from '../../../../../models/movie';
import { File } from '../../../../../models/file';
import { promises as fs } from 'fs';
import errors from 'restify-errors';
import { createStreamsList } from '../../../helpers';
import { Stream } from '../../../../../models/stream';

/**
 *
 * @param server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.get('/items', async (req, res) => {
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
                    'HasSubtitles': false,
                    'Container': 'mkv,webm',
                    'PremiereDate': movie.releaseDate,
                    'CriticRating': 82,
                    'OfficialRating': 'PG-13',
                    'CommunityRating': 2.6,
                    'RunTimeTicks': movie.runtime,
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
    });

    server.get('/items/:mediaid/images/backdrop/:artworkid', async (req, res) => {
        let mediaid = req.params.mediaid;

        if (mediaid.includes('movie')) {
            let movie = await Movie.findByPk(mediaid.replace('movie', ''), { include: [File] });

            let posterPath = embyEmulation.oblecto.artworkUtils.movieFanartPath(movie, 'large');

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

        }

        let MediaSources = [];

        for (let file of files) {
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
                'ReadAtNativeFramerate': true,
                'IgnoreDts': false,
                'IgnoreIndex': false,
                'GenPtsInput': false,
                'SupportsTranscoding': false,
                'SupportsDirectStream': true,
                'SupportsDirectPlay': false,
                'autoOpenLiveStream': false,
                'IsInfiniteStream': false,
                'RequiresOpening': false,
                'RequiresClosing': false,
                'RequiresLooping': false,
                'SupportsProbing': true,
                'VideoType': 'VideoFile',
                'MediaStreams': createStreamsList(files.Streams),
                'MediaAttachments': [],
                'Formats': [],
                'Bitrate': file.size / file.duration,
                'RequiredHttpHeaders': {},
                // 'TranscodingUrl': '/videos/c042cd5e-c05a-5397-5b85-3b127bea567b/master.m3u8?DeviceId=TW96aWxsYS81LjAgKFgxMTsgTGludXggeDg2XzY0OyBydjo4Mi4wKSBHZWNrby8yMDEwMDEwMSBGaXJlZm94LzgyLjB8MTU5OTg2NDM5ODY2Mg11&MediaSourceId=c042cd5ec05a53975b853b127bea567b&VideoCodec=h264&AudioCodec=mp3,aac&AudioStreamIndex=1&VideoBitrate=139616000&AudioBitrate=384000&PlaySessionId=c89d3c1e027b4463b59bcd06e183679f&api_key=28eece16e48a4bb997e2137297d36321&TranscodingMaxAudioChannels=2&RequireAvc=false&Tag=313f5f26c5f6636a77c630468b6920f7&SegmentContainer=ts&MinSegments=1&BreakOnNonKeyFrames=True&h264-profile=high,main,baseline,constrainedbaseline&h264-level=51&h264-deinterlace=true&TranscodeReasons=VideoCodecNotSupported',
                // 'TranscodingSubProtocol': 'hls',
                // 'TranscodingContainer': 'ts',
                'DefaultAudioStreamIndex': 1,
                'DefaultSubtitleStreamIndex': 2
            });
        }

        res.send({
            'UserId': '08ba1929-681e-4b24-929b-9245852f65c0',
            'MaxStreamingBitrate': 0,
            'StartTimeTicks': 0,
            'AudioStreamIndex': 0,
            'SubtitleStreamIndex': 0,
            'MaxAudioChannels': 0,
            'MediaSourceId': 'string',
            'LiveStreamId': 'string',
            'DeviceProfile':
                {
                    'Name': 'string',
                    'Id': 'string',
                    'Identification': {},
                    'FriendlyName': 'string',
                    'Manufacturer': 'string',
                    'ManufacturerUrl': 'string',
                    'ModelName': 'string',
                    'ModelDescription': 'string',
                    'ModelNumber': 'string',
                    'ModelUrl': 'string',
                    'SerialNumber': 'string',
                    'EnableAlbumArtInDidl': false,
                    'EnableSingleAlbumArtLimit': false,
                    'EnableSingleSubtitleLimit': false,
                    'SupportedMediaTypes': 'string',
                    'UserId': 'string',
                    'AlbumArtPn': 'string',
                    'MaxAlbumArtWidth': 0,
                    'MaxAlbumArtHeight': 0,
                    'MaxIconWidth': 0,
                    'MaxIconHeight': 0,
                    'MaxStreamingBitrate': 0,
                    'MaxStaticBitrate': 0,
                    'MusicStreamingTranscodingBitrate': 0,
                    'MaxStaticMusicBitrate': 0,
                    'SonyAggregationFlags': 'string',
                    'ProtocolInfo': 'string',
                    'TimelineOffsetSeconds': 0,
                    'RequiresPlainVideoItems': false,
                    'RequiresPlainFolders': false,
                    'EnableMSMediaReceiverRegistrar': false,
                    'IgnoreTranscodeByteRangeRequests': false,
                    'XmlRootAttributes':
                        [],
                    'DirectPlayProfiles':
                        [
                            {

                                'Container': 'mp4',
                                'Type': 'Video',
                                'VideoCodec': 'h264',
                                'AudioCodec': 'aac',
                                'Protocol': 'Http',
                                'EstimateContentLength': false,
                                'EnableMpegtsM2TsMode': false,
                                'TranscodeSeekInfo': 'Auto',
                                'CopyTimestamps': false,
                                'Context': 'Streaming',
                                'EnableSubtitlesInManifest': false,
                                'MaxAudioChannels': 'string',
                                'MinSegments': 0,
                                'SegmentLength': 0,
                                'BreakOnNonKeyFrames': false,
                                'Conditions':

                                    []
                            }
                        ],
                    'TranscodingProfiles':
                        [],
                    'ContainerProfiles':
                        [],
                    'CodecProfiles':
                        [],
                    'ResponseProfiles':
                        [],
                    'SubtitleProfiles':

                        []
                },
            'EnableDirectPlay': true,
            'EnableDirectStream': true,
            'EnableTranscoding': false,
            'AllowVideoStreamCopy': true,
            'AllowAudioStreamCopy': true,
            'AutoOpenLiveStream': false

        });
    });

};
