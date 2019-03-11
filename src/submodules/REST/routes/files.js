import sequelize from 'sequelize';
import fs from 'fs';
import ffmpeg from '../../../submodules/ffmpeg';

import databases from '../../../submodules/database';
import authMiddleWare from '../middleware/auth';
import config from '../../../config';


export default (server) => {
    // Endpoint to send video files to the client
    server.get('/stream/:id', async function (req, res, next) {
        // search for attributes
        let fileInfo = await databases.file.findById(req.params.id);

        req.video = {};

        req.video.path = fileInfo.path;
        req.video.fileInfo = fileInfo;
        req.video.size = fs.statSync(req.video.path).size;

        let mime = 'video';

        let mimes = {
            'mp4': 'video/mp4',
            'mkv': 'video/x-matroska',
            'avi': 'video/avi',
        };

        if (mimes[fileInfo.extension])
            req.video.mime = mimes[fileInfo.extension];

        // Transcode
        if (config.transcoding.doRealTime && fileInfo.extension !== 'mp4')
            return next();

        if (req.headers.range) { // meaning client (browser) has moved the forward/back slider
            // which has sent this request back to this server logic ... cool
            var range = req.headers.range;
            var parts = range.replace(/bytes=/, '').split('-');
            var partialstart = parts[0];
            var partialend = parts[1];

            var start = parseInt(partialstart, 10);
            var end = partialend ? parseInt(partialend, 10) : req.video.size  - 1;
            var chunksize = (end - start) + 1;
            console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize);

            var file = fs.createReadStream(req.video.path , {
                start: start,
                end: end
            });

            res.writeHead(206, {
                'Content-Range': 'bytes ' + start + '-' + end + '/' + req.video.size,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': req.video.mime
            });

            file.pipe(res);

        } else {

            console.log('ALL: ' + req.video.size);

            res.writeHead(200, {
                'Content-Length': req.video.size,
                'Accept-Ranges': 'bytes',
                'Content-Type': req.video.mime
            });

            fs.createReadStream(req.video.path).pipe(res);
        }

    }, async function (req, res, next) {
        console.log(req.video)

        res.writeHead(200, {
            'Content-Type': 'video/mp4'
        });

        ffmpeg(req.video.path)
            .native()
            .format('mp4')
            .audioBitrate('1024k')
            .videoCodec('mpeg4')
            .audioBitrate('128k')
            .audioChannels(2)
            .audioCodec('libmp3lame')
            .outputOptions([
                '-movflags', 'empty_moov',
            ])


            // setup event handlers

            // save to stream
            .on("start", (cmd)=>{
                console.log("--- ffmpeg start process ---")
                console.log(`cmd: ${cmd}`)
            })
            .on("end",()=>{
                console.log("--- end processing ---")
            })
            .on("error", (err)=>{
                console.log("--- ffmpeg meets error ---")
                console.log(err)
            })
            .pipe(res, {end:true});
    });
};