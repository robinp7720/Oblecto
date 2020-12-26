import errors from 'restify-errors';
import authMiddleWare from '../middleware/auth';
import {File} from '../../../models/file';
import DirectHttpStreamSession from '../../../lib/streamSessions/StreamSessionTypes/DirectHttpStreamSession';
import HLSStreamer from '../../../lib/streamSessions/StreamSessionTypes/HLSStreamer';

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

    server.get('/session/create/:id', authMiddleWare.requiresAuth, async function (req, res, next) {
        let file;

        try {
            file = await File.findByPk(req.params.id);
        } catch (ex) {
            return next(new errors.NotFoundError('File does not exist'));
        }

        if (!file) return next(new errors.NotFoundError('File does not exist'));

        let streamType = 'recode';

        if (['recode', 'directhttp', 'hls'].indexOf(req.params.type) > -1) {
            streamType = req.params.type;
        }

        if (req.params.noremux) streamType = 'directhttp';

        let streamSession = oblecto.streamSessionController.newSession(file, {
            streamType,

            target: {
                formats: (req.params.format || 'mp4').split(','),
                videoCodecs: (req.params.videoCodec || 'h264').split(','),
                audioCodecs: (req.params.audioCodec || 'aac').split(',')
            },

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
        let streamSession = oblecto.streamSessionController.sessions[req.params.sessionId];

        if (req.params.offset) {
            streamSession.offset = req.params.offset;
        }

        await streamSession.addDestination({
            request: req,
            stream: res,

            type: 'http'
        });

        if (req.params.nostart) return;

        await streamSession.startStream();
    });
};
