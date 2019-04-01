import sequelize from 'sequelize';
import fs from 'fs';
import ffmpeg from '../../../submodules/ffmpeg';
import databases from '../../../submodules/database';
import authMiddleWare from '../middleware/auth';
import config from '../../../config';

import HLSSession from '../../HLS/session';
import os from "os";

import DirectStreamer from '../../handlers/DirectStreamer';
import errors from "restify-errors";

let HLSSessions = {};

export default (server) => {
    // Endpoint to send video files to the client
    server.get('/stream/:id', async function (req, res, next) {
        // search for attributes
        let fileInfo = await databases.file.findById(req.params.id);

        // Transcode
        if (config.transcoding.doRealTime && fileInfo.extension !== 'mp4')
            return next();


        DirectStreamer.streamFile(fileInfo.path, req, res)

    }, async function (req, res, next) {
        // TODO: Determine whether or not to remux or transcode depending on video encoding
        res.writeHead(200, {
            'Content-Type': 'video/mp4'
        });

        ffmpeg(req.video.path)
            //.native()
            .format('mp4')
            .videoCodec('copy')
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


    server.get('/stream/:id/:seek',  async function (req, res, next) {
        // TODO: Determine whether or not to remux or transcode depending on video encoding

        let fileInfo = await databases.file.findById(req.params.id);

        req.video = {};

        req.video.path = fileInfo.path;

        res.writeHead(200, {
            'Content-Type': 'video/mp4'
        });

        ffmpeg(req.video.path)
            .native()
            .format('mp4')
            .videoCodec('copy')
            //.audioBitrate('128k')
            //.videoBitrate(500)
            .seekInput(req.params.seek)
            .audioCodec('libmp3lame')
            .outputOptions([
                '-movflags', `empty_moov`,
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

    server.get('/HLS/:session/segment/:id',  async function (req, res, next) {
        // TODO: Determine whether or not to remux or transcode depending on video encoding

        if (!HLSSessions[req.params.session]) {
            return next(new errors.NotFoundError('Session does not exist'));
        }

        let segmentId = parseInt(req.params.id);

        DirectStreamer.streamFile(
            `${os.tmpdir()}/oblecto/sessions/${req.params.session}/${('000' + segmentId).substr(-3)}.ts`,
            req, res
        );

        // While that file is being streamed, we need to make sure that the next segment will be available.
        // Check if the next file in the sequence exists, and it it doesn't resume ffmpeg and delete the first few
        // segments.

        console.log(`${os.tmpdir()}/oblecto/sessions/${req.params.session}/${('000' + (segmentId + 3)).substr(-3)}.ts`);
        fs.access(`${os.tmpdir()}/oblecto/sessions/${req.params.session}/${('000' + (segmentId + 3)).substr(-3)}.ts`, fs.constants.F_OK, (err) => {
            if (!err)
                return

            fs.readdir(`${os.tmpdir()}/oblecto/sessions/${req.params.session}/`, (err, files) => {
                if (err) {
                    return false;
                }

                files.forEach(function (val, index) {
                    let sequenceId = val.replace('index', '')
                        .replace('.vtt', '')
                        .replace('.ts', '');

                    sequenceId = parseInt(sequenceId);


                    if (segmentId - sequenceId > 5) {
                        fs.unlink(`${os.tmpdir()}/oblecto/sessions/${req.params.session}/${val}`, (err) => {
                            if (err) {
                                console.error(err);
                            }
                        });
                    }
                })


            });
        });

    });

    server.get('/HLS/:session/playlist',  async function (req, res, next) {
        if (!HLSSessions[req.params.session]) {
            return next(new errors.NotFoundError('Session does not exist'));
        }


        res.writeHead(200, {
            'Content-Type': 'application/x-mpegURL'
        });

        try {
            fs.createReadStream(`${os.tmpdir()}/oblecto/sessions/${req.params.session}/index.m3u8`).pipe(res);
        } catch (e) {
            console.log(e);

            return next(new errors.NotFoundError('Playlist file doesn\'t exist'));
        }

    });


    server.get('/HLS/create/:id/',  async function (req, res, next) {
        let session = new HLSSession(req.params.id);

        HLSSessions[session.sessionId] = session;

        res.send(session.sessionId)

    });
};
