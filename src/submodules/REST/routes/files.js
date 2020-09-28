import fs from 'fs';
import errors from 'restify-errors';
import os from 'os';

import authMiddleWare from '../middleware/auth';

import HLSSession from '../../handlers/HLSSessionHandler';

import DirectStreamer from '../../handlers/DirectStreamer';
import {File} from '../../../models/file';
import DirectHttpStreamSession from '../../../lib/streamSessions/StreamSessionTypes/DirectHttpStreamSession';

let HLSSessions = {};

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
        let file;

        try {
            file = await File.findByPk(req.params.id);
        } catch (ex) {
            return next(new errors.NotFoundError('File does not exist'));
        }

        let streamType = 'recode';

        if (req.params.noremux) streamType = 'directhttp';

        if (file.extension === 'mp4') streamType = 'directhttp';
        if(['ac3'].indexOf(file.audioCodec) > -1) streamType = 'recode';

        let streamSession = oblecto.streamSessionController.newSession(file, {
            streamType,

            format: req.params.format || 'mp4',
            videoCodec: req.params.videoCodec || 'h264',
            audioCodec: req.params.audioCodec || 'aac',

            offset: req.params.offset || 0
        });

        res.send({
            sessionId: streamSession.sessionId,
            seeking: streamSession instanceof DirectHttpStreamSession ? 'client' : 'server'
        });
    });

    server.get('/session/stream/:sessionId', async function (req, res, next) {
        if (!oblecto.streamSessionController.sessionExists(req.params.sessionId)) {
            return next(new errors.InvalidCredentialsError('Stream session token does not exist'));
        }

        return next();
    }, async function (req, res, next) {
        oblecto.streamSessionController.sessions[req.params.sessionId].offset = req.params.offset || 0;

        await oblecto.streamSessionController.sessions[req.params.sessionId].addDestination({
            request: req,
            stream: res,

            type: 'http'
        });

        await oblecto.streamSessionController.sessions[req.params.sessionId].startStream();
    });
};
