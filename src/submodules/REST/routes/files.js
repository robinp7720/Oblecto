import fs from 'fs';
import uuid from 'node-uuid';
import errors from 'restify-errors';
import os from 'os';

import databases from '../../../submodules/database';
import authMiddleWare from '../middleware/auth';

import HLSSession from '../../handlers/HLSSessionHandler';

import DirectStreamer from '../../handlers/DirectStreamer';
import FFMPEGStreamer from '../../handlers/FFMPEGStreamer';
import FederationStreamer from '../../handlers/FederationStreamer';

let HLSSessions = {};
let StreamSessions = {};

/**
 *
 * @param {Server} server
 * @param {Oblecto} oblecto
 */
export default (server, oblecto) => {
    server.get('/HLS/:session/segment/:id', async function (req, res, next) {
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

    server.get('/HLS/:session/playlist', async function (req, res, next) {
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

        let seeking = 'client';

        if ((oblecto.config.transcoding.doRealTimeRemux || oblecto.config.transcoding.doRealTimeTranscode) && fileInfo.extension !== 'mp4' && !req.params.noremux) {
            seeking = 'server';
        }

        if (fileInfo.host !== 'local') {
            seeking = 'server';
        }

        StreamSessions[sessionId] = {
            file: req.params.id,
            fileInfo: fileInfo.toJSON(),
            seeking,
            disableRemux: req.params.noremux || false
        };

        StreamSessions[sessionId].timeout = setTimeout(() => {
            delete StreamSessions[sessionId];
        }, 1000000);

        res.send({sessionId, seeking});
    });

    server.get('/session/stream/:sessionId', async function (req, res, next) {
        if (!StreamSessions[req.params.sessionId]) {
            return next(new errors.InvalidCredentialsError('Stream session token does not exist'));
        }

        return next();
    }, async function (req, res, next) {
        // search for attributes
        let fileInfo = StreamSessions[req.params.sessionId].fileInfo;

        req.video = fileInfo;

        // Transcode
        if (StreamSessions[req.params.sessionId].seeking === 'server') {
            return next();
        }

        clearTimeout(StreamSessions[req.params.sessionId].timeout);

        StreamSessions[req.params.sessionId].timeout = setTimeout(() => {
            delete StreamSessions[req.params.sessionId];
        }, fileInfo.duration * 1000);

        DirectStreamer.streamFile(oblecto, fileInfo.path, req, res);

    }, async function (req, res, next) {
        // TODO: Determine whether or not to remux or transcode depending on video encoding

        if (StreamSessions[req.params.sessionId]) {
            delete StreamSessions[req.params.sessionId];
        }

        res.writeHead(200, {
            'Content-Type': 'video/mp4'
        });

        FFMPEGStreamer.streamFile(oblecto, req.video, req.params.offset || 0, req, res);
    });
};
