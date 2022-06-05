import errors from 'restify-errors';
import authMiddleWare from '../middleware/auth';
import { File } from '../../../models/file';
import DirectHttpStreamSession from '../../../lib/streamSessions/StreamSessionTypes/DirectHttpStreamSession';
import HLSStreamer from '../../../lib/streamSessions/StreamSessionTypes/HLSStreamer';

/**
 * @typedef {import('../../../lib/oblecto').default} Oblecto
 * @typedef {import('restify/lib/server')} Server
 */

/**
 * Add routes for streaming
 *
 * @param {Server} server - Restify server object
 * @param {Oblecto} oblecto - Oblecto server instance
 */
export default (server, oblecto) => {
    server.get('/HLS/:sessionId/segment/:id', async function (req, res) {
        if (!oblecto.streamSessionController.sessionExists(req.params.sessionId)) {
            return new errors.InvalidCredentialsError('Stream session token does not exist');
        }

        let streamSession = oblecto.streamSessionController.sessions[req.params.sessionId];

        // TODO: Send appropriate error if session is not a HLS stream session
        if (!(streamSession instanceof HLSStreamer)) return;

        let segmentId = parseInt(req.params.id);

        await streamSession.streamSegment(req, res, segmentId);
    });

    server.get('/session/create/:id', authMiddleWare.requiresAuth, async function (req, res) {
        let file;
        let formats = (req.params.formats || 'mp4').split(',');
        let videoCodecs = (req.params.videoCodecs || 'h264').split(',');
        let audioCodecs = (req.params.audioCodec || 'aac').split(',');

        try {
            file = await File.findByPk(req.params.id);
        } catch (ex) {
            return new errors.NotFoundError('File does not exist');
        }

        if (!file) return new errors.NotFoundError('File does not exist');

        let streamType = 'recode';

        if (['recode', 'directhttp', 'hls'].indexOf(req.params.type) > -1) {
            streamType = req.params.type;
        }

        if (req.params.noremux) streamType = 'directhttp';

        let streamSession = oblecto.streamSessionController.newSession(file, {
            streamType,

            target: {
                formats, videoCodecs, audioCodecs
            },

            offset: req.params.offset || 0
        });

        res.send({
            sessionId: streamSession.sessionId,
            seeking: streamSession instanceof DirectHttpStreamSession ? 'client' : 'server'
        });
    });

    server.get('/session/stream/:sessionId', async function (req, res) {
        if (!oblecto.streamSessionController.sessionExists(req.params.sessionId)) {
            return new errors.InvalidCredentialsError('Stream session token does not exist');
        }
    }, async function (req, res) {
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
