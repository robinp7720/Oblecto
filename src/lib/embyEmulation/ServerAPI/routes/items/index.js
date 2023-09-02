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
                    'RunTimeTicks': movie.runtime*100000000,
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
                    'ServerId':'70301c9fe99e4304bd5c8922b0e2fd90',
                    'Id': `series${series.id}`,
                    'PremiereDate': series.firstAired,
                    'OfficialRating':'TV-14',
                    'ChannelId':null,
                    'CommunityRating':series.popularity,
                    'RunTimeTicks': series.runtime * 100000000,
                    'ProductionYear': series.firstAired.substring(0, 4),
                    'IsFolder':true,
                    'Type':'Series',
                    'UserData':{
                        'UnplayedItemCount':13,'PlaybackPositionTicks':0,'PlayCount':0,'IsFavorite':false,'Played':false,'Key':'272644'
                    },
                    'Status': series.status,
                    'AirDays':[series.airsDayOfWeek],
                    'PrimaryImageAspectRatio':0.6666666666666666,
                    'ImageTags':{ 'Primary':'d4ded7fd31f038b434148a4e162e031d' },
                    'BackdropImageTags':['64e8f381684663b6a7f0d2c1cac61d08'],
                    'ImageBlurHashes':{ 'Backdrop':{ '64e8f381684663b6a7f0d2c1cac61d08':'WU7xLXWARPt8V?f,%jRhROt7V?fmx_RiRiogackCtTaxaykCackC' },'Primary':{ 'd4ded7fd31f038b434148a4e162e031d':'d23[JJxG9rW=;LbHS$sT*^n%Tfn$TfW:aIniX:bIRhbb' } },
                    'LocationType':'FileSystem',
                    'EndDate':null
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
                        include: [{ model: Stream }],
                    }
                ]
            });

            files = movie.Files;
        }
        else if (mediaid.includes('series')) {
            let series = await Series.findByPk(req.params.mediaid.replace('series', ''), {
                include: [
                    {
                        model: File,
                        include: [{ model: Stream }],
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
                    formats: ['mp4, mkv'], videoCodecs: ['h264', 'hevc'], audioCodecs: []
                }
            });

        res.send({
            'MediaSources': files.map((file) => {
                return {
                    'Protocol':'File',
                    'Id': file.id,
                    'Path':file.path,
                    'Type':'Default',
                    'Container':'mkv',
                    'Size':file.size,
                    'Name':file.name,
                    'IsRemote':false,
                    'ETag':'3670b404eb5adec1d6cd73868ad1801c',
                    'RunTimeTicks':file.duration*10000000,
                    'ReadAtNativeFramerate':false,
                    'IgnoreDts':false,
                    'IgnoreIndex':false,
                    'GenPtsInput':false,
                    'SupportsTranscoding':true,
                    'SupportsDirectStream':true,
                    'SupportsDirectPlay':true,
                    'IsInfiniteStream':false,
                    'RequiresOpening':false,
                    'RequiresClosing':false,
                    'RequiresLooping':false,
                    'SupportsProbing':true,
                    'VideoType':'VideoFile',
                    'MediaStreams':createStreamsList(file.Streams),
                    'MediaAttachments':[],
                    'Formats':[],
                    'Bitrate':file.size/file.duration,
                    'RequiredHttpHeaders':{},
                    'DefaultAudioStreamIndex':1,
                    'DefaultSubtitleStreamIndex':2
                };
            }),
            'PlaySessionId':streamSession.sessionId
        });

        console.log('playback info complete');
    });

};
