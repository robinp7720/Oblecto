/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-nullish-coalescing */
import { Express, Request, Response, NextFunction } from 'express';
import errors from '../errors.js';
import authMiddleWare from '../middleware/auth.js';
import { File } from '../../../models/file.js';
import { DirectHttpStreamSession, HlsStreamSession } from '../../../lib/mediaSessions/index.js';
import Oblecto from '../../../lib/oblecto/index.js';
import { OblectoRequest } from '../index.js';

export default (server: Express, oblecto: Oblecto) => {
    server.get('/HLS/:sessionId/segment/:id', async function (req: Request, res: Response, next: NextFunction) {
        try {
            const sessionId = req.params.sessionId;

            if (!oblecto.streamSessionController.sessionExists(sessionId)) {
                throw new errors.InvalidCredentialsError('Stream session token does not exist');
            }

            const streamSession = oblecto.streamSessionController.sessions[sessionId];

            if (!(streamSession instanceof HlsStreamSession)) {
                throw new errors.BadRequestError('Invalid stream session type');
            }

            const segmentId = parseInt(req.params.id);

            await streamSession.streamSegment(req, res, segmentId);
        } catch (error) {
            next(error);
        }
    });

    server.get('/session/create/:id', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response, next: NextFunction) {
        try {
            let file;
            const params = req.combined_params!;
            const formats = ((params.formats as string) || 'mp4').split(',');
            const videoCodecs = ((params.videoCodecs as string) || 'h264').split(',');
            const audioCodecs = ((params.audioCodec as string) || 'aac').split(',');

            try {
                file = await File.findByPk(req.params.id);
            } catch (ex) {
                throw new errors.NotFoundError('File does not exist');
            }

            if (!file) throw new errors.NotFoundError('File does not exist');

            let streamType = 'recode';

            if (params.type && ['recode', 'directhttp', 'hls'].indexOf(params.type as string) > -1) {
                streamType = params.type as string;
            }

            if (params.noremux) streamType = 'directhttp';

            const streamSession = oblecto.streamSessionController.newSession(file, {
                streamType,

                target: {
                    formats, videoCodecs, audioCodecs
                },

                offset: (params.offset as number) || 0
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

    server.get('/session/stream/:sessionId', async function (req: OblectoRequest, res: Response, next: NextFunction) {
        try {
            if (!oblecto.streamSessionController.sessionExists(req.params.sessionId)) {
                throw new errors.InvalidCredentialsError('Stream session token does not exist');
            }

            const streamSession = oblecto.streamSessionController.sessions[req.params.sessionId];

            // For HLS sessions, if the segmenter is already started, this is a playlist poll request
            // Just serve the fresh playlist without adding destinations or restarting
            if (streamSession instanceof HlsStreamSession && streamSession.segmenterStarted) {
                await streamSession.sendPlaylistFile(res);
                return;
            }

            if (req.combined_params?.offset) {
                streamSession.offset = req.combined_params.offset as number;
            }

            await streamSession.addDestination({
                request: req,
                stream: res,

                type: 'http'
            });

            if (req.combined_params?.nostart) return;

            await streamSession.startStream();
        } catch (error) {
            next(error);
        }
    });
};