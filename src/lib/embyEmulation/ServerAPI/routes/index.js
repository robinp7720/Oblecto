import system from './system';
import users from './users';
import sessions from './sessions';
import displaypreferences from './displaypreferences';
import branding from './branding';
import shows from './shows'


import {Movie} from '../../../../models/movie';
import {File} from '../../../../models/file';
import fs from "fs";
import errors from 'restify-errors';

/**
 *
 * @param server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    system(server, embyEmulation);
    users(server, embyEmulation);
    sessions(server, embyEmulation);
    displaypreferences(server, embyEmulation);
    branding(server, embyEmulation);
    shows(server, embyEmulation);

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

};
