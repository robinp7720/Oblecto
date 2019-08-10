import sequelize from 'sequelize';
import fs from 'fs';
import ffmpeg from '../../../submodules/ffmpeg';
import databases from '../../../submodules/database';
import authMiddleWare from '../middleware/auth';
import uuid from 'node-uuid';
import config from '../../../config';

import HLSSession from '../../handlers/HLSSessionHandler';
import os from 'os';

import DirectStreamer from '../../handlers/DirectStreamer';
import FFMPEGStreamer from '../../handlers/FFMPEGStreamer';
import errors from 'restify-errors';

let HLSSessions = {};
let StreamSessions = {};

/**
 *
 * @param {Server} server
 */
export default (server) => {
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
        // segments.b

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
            });
        });
    });

    server.get('/HLS/:session/playlist',  async function (req, res, next) {
        if (!HLSSessions[req.params.session]) {
            return next(new errors.NotFoundError('Session does not exist'));
        }

        fs.access(`${os.tmpdir()}/oblecto/sessions/${req.params.session}/index.m3u8`, fs.constants.F_OK, (err) => {
            if (err) {
                return next(new errors.NotFoundError('Playlist file doesn\'t exist'));
            }

            HLSSessions[req.params.session].resetTimeout();

            res.writeHead(200, {
                'Content-Type': 'application/x-mpegURL'
            });

            fs.createReadStream(`${os.tmpdir()}/oblecto/sessions/${req.params.session}/index.m3u8`).pipe(res);
        });
    });


    server.get('/HLS/create/:id', authMiddleWare.requiresAuth, async function (req, res, next) {
        let session = new HLSSession(req.params.id);

        if (req.query.offset) {
            session.offset = req.query.offset;
        }

        await session.start();

        HLSSessions[session.sessionId] = session;

        res.send(session.sessionId);

    });

    server.get('/session/create/:id', authMiddleWare.requiresAuth, async function (req, res, next) {
        let fileInfo;

        try {
            fileInfo = await databases.file.findByPk(req.params.id);
        } catch (ex) {
            return next(new errors.NotFoundError('File does not exist'));
        }

        let sessionId = uuid.v4();

        StreamSessions[sessionId] = {
            file: req.params.id,
            fileInfo
        };

        setTimeout(() => {
            delete StreamSessions[sessionId];
        }, 10000);

        res.send({sessionId});
    });

    server.get('/session/stream/:sessionId', async function (req, res, next) {
        if (!StreamSessions[req.params.sessionId]) {
            return next(new errors.InvalidCredentialsError('Stream session token does not exist'));
        }

        return next();
    }, async function (req, res, next) {
        // search for attributes
        let fileInfo = await databases.file.findByPk(req.params.id);

        req.video = fileInfo;

        // Transcode
        if (
            (
                config.transcoding.doRealTimeRemux ||
                config.transcoding.doRealTimeTranscode
            ) &&
            fileInfo.extension !== 'mp4') {
            return next();
        }

        DirectStreamer.streamFile(fileInfo.path, req, res);

    }, async function (req, res, next) {
        // TODO: Determine whether or not to remux or transcode depending on video encoding

        FFMPEGStreamer.streamFile(req.video.path, req.params.offset || 0, req, res);
    });
};
