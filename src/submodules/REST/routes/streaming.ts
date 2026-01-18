import { Express, Request, Response, NextFunction } from 'express';
import errors from '../errors.js';
import authMiddleWare from '../middleware/auth.js';
import { File } from '../../../models/file.js';
import DirectHttpStreamSession from '../../../lib/streamSessions/StreamSessionTypes/DirectHttpStreamSession.js';
import HLSStreamer from '../../../lib/streamSessions/StreamSessionTypes/HLSStreamer.js';

export default (server: Express, oblecto: any) => {
    server.get('/HLS/:sessionId/segment/:id', async function (req: any, res: Response, next: NextFunction) {
        try {
            if (!oblecto.streamSessionController.sessionExists(req.combined_params.sessionId)) {
                throw new errors.InvalidCredentialsError('Stream session token does not exist');
            }

            let streamSession = oblecto.streamSessionController.sessions[req.combined_params.sessionId];

            if (!(streamSession instanceof HLSStreamer)) {
                throw new errors.BadRequestError('Invalid stream session type');
            }

            let segmentId = parseInt(req.params.id);

            await streamSession.streamSegment(req, res, segmentId);
        } catch (error) {
            next(error);
        }
    });

    server.get('/session/create/:id', authMiddleWare.requiresAuth, async function (req: any, res: Response, next: NextFunction) {
        try {
            let file;
            let formats = (req.combined_params.formats || 'mp4').split(',');
            let videoCodecs = (req.combined_params.videoCodecs || 'h264').split(',');
            let audioCodecs = (req.combined_params.audioCodec || 'aac').split(',');

            try {
                file = await File.findByPk(req.params.id);
            } catch (ex) {
                throw new errors.NotFoundError('File does not exist');
            }

            if (!file) throw new errors.NotFoundError('File does not exist');

            let streamType = 'recode';

            if (['recode', 'directhttp', 'hls'].indexOf(req.combined_params.type) > -1) {
                streamType = req.combined_params.type;
            }

            if (req.combined_params.noremux) streamType = 'directhttp';

            let streamSession = oblecto.streamSessionController.newSession(file, {
                streamType,

                target: {
                    formats, videoCodecs, audioCodecs
                },

                offset: req.combined_params.offset || 0
            });

            res.send({
                sessionId: streamSession.sessionId,
                seeking: streamSession instanceof DirectHttpStreamSession ? 'client' : 'server',
                outputCodec: {
                    video: streamSession.videoCodec,
                    audio: streamSession.audioCodec
                },
                inputCodec: { video: streamSession.file.videoCodec, audio: streamSession.file.audioCodec }
            });
        } catch (error) {
            next(error);
        }
    });

    server.get('/session/stream/:sessionId', async function (req: any, res: Response, next: NextFunction) {
        try {
            if (!oblecto.streamSessionController.sessionExists(req.params.sessionId)) {
                throw new errors.InvalidCredentialsError('Stream session token does not exist');
            }

            let streamSession = oblecto.streamSessionController.sessions[req.params.sessionId];

            if (req.combined_params.offset) {
                streamSession.offset = req.combined_params.offset;
            }

            await streamSession.addDestination({
                request: req,
                stream: res,

                type: 'http'
            });

            if (req.combined_params.nostart) return;

            await streamSession.startStream();
        } catch (error) {
            next(error);
        }
    });
};
