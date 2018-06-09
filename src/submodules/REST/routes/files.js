import sequelize from 'sequelize';
import path from 'path';
import fs from 'fs';

import databases from '../../../submodules/database';
import authMiddleWare from '../middleware/auth';

export default (server) => {
    // Endpoint to get the files currently being watched
    server.get('/watching', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let tracks = await databases.trackEpisodes.findAll({
            include: [{
                model: databases.episode,
                required: true,
                include: [
                    databases.tvshow,
                    {
                        model: databases.trackEpisodes,
                        required: false,
                        where: {
                            userId: req.authorization.jwt.id
                        }
                    }
                ]
            }],
            where: {
                userId: req.authorization.jwt.id,
                progress: {
                    [sequelize.Op.lt]: 0.9
                }
            },
            order: [
                ['updatedAt', 'DESC'],
            ],
        });

        // We are only interested in the episode objects, so extract all the episode object from 
        // each track object and send the final mapped array to the client
        res.send(tracks.map((track) => {
            return track.episode;
        }));
    });

    // Endpoint to send episode video file to the client
    // TODO: move this to the file route and use file id to play, abstracting this from episodes
    server.get('/stream/:id', async function (req, res) {
        // search for attributes
        let fileInfo = await databases.file.findById(req.params.id);
        
        let path = fileInfo.path;
        var stat = fs.statSync(path);
        var total = stat.size;

        let mime = 'video/mp4';

        switch (fileInfo.container) {
            case 'MPEG-4 Part 14':
                mime = 'video/mp4';
                break;
            case 'Matroska':
                mime = 'video/x-matroska';
                break;
            case 'Audio Video Interleave':
                mime = 'video/avi';
                break;
            default:
                mime = 'video';
                break;
        }

        if (req.headers.range) { // meaning client (browser) has moved the forward/back slider
            // which has sent this request back to this server logic ... cool
            var range = req.headers.range;
            var parts = range.replace(/bytes=/, '').split('-');
            var partialstart = parts[0];
            var partialend = parts[1];

            var start = parseInt(partialstart, 10);
            var end = partialend ? parseInt(partialend, 10) : total - 1;
            var chunksize = (end - start) + 1;
            console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize);

            var file = fs.createReadStream(path, {
                start: start,
                end: end
            });

            res.writeHead(206, {
                'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': mime
            });

            file.pipe(res);

        } else {

            console.log('ALL: ' + total);

            res.writeHead(200, {
                'Content-Length': total,
                'Content-Type': mime
            });

            fs.createReadStream(path).pipe(res);
        }

    });
};