import fs from 'fs';
import errors from 'restify-errors';
import os from 'os';

import authMiddleWare from '../middleware/auth';

import HLSSession from '../../handlers/HLSSessionHandler';

import DirectStreamer from '../../handlers/DirectStreamer';
import {File} from '../../../models/file';
import DirectHttpStreamSession from '../../../lib/streamSessions/StreamSessionTypes/DirectHttpStreamSession';
import HLSStreamer from '../../../lib/streamSessions/StreamSessionTypes/HLSStreamer';

let HLSSessions = {};

/**
 *
 * @param {Server} server
 * @param {Oblecto} oblecto
 */
export default (server, oblecto) => {
    server.get('/HLS/:sessionId/segment/:id', async function (req, res, next) {
        if (!oblecto.streamSessionController.sessionExists(req.params.sessionId)) {
            return next(new errors.InvalidCredentialsError('Stream session token does not exist'));
        }

        let streamSession = oblecto.streamSessionController.sessions[req.params.sessionId];

        // TODO: Send approriate error if session is not a HLS stream session
        if (!(streamSession instanceof HLSStreamer)) return next();

        let segmentId = parseInt(req.params.id);

        streamSession.streamSegment(req, res, segmentId);
    });

    server.get('/HLS/:sessionId/playlist', async function (req, res, next) {
        if (!oblecto.streamSessionController.sessionExists(req.params.sessionId)) {
            return next(new errors.InvalidCredentialsError('Stream session token does not exist'));
        }

        let streamSession = oblecto.streamSessionController.sessions[req.params.sessionId];

        // TODO: Send approriate error if session is not a HLS stream session
        if (!(streamSession instanceof HLSStreamer)) return next(new errors.InvalidContentError('Not a HLS stream'));

        streamSession.sendPlaylistFile(res);
    });


    server.get('/session/create/:id'/*, authMiddleWare.requiresAuth*/, async function (req, res, next) {
        let file;

        try {
            file = await File.findByPk(req.params.id);
        } catch (ex) {
            return next(new errors.NotFoundError('File does not exist'));
        }

        if (!file) return next(new errors.NotFoundError('File does not exist'));

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
