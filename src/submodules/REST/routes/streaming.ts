/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/unbound-method, @typescript-eslint/no-unused-vars */
import { Express, Request, Response, NextFunction } from 'express';
import errors from '../errors.js';
import authMiddleWare from '../middleware/auth.js';
import { File } from '../../../models/file.js';
import { Stream } from '../../../models/stream.js';
import { DirectHttpStreamSession, HlsStreamSession } from '../../../lib/mediaSessions/index.js';
import Oblecto from '../../../lib/oblecto/index.js';
import { OblectoRequest } from '../index.js';
import logger from '../../logger/index.js';

const parseOptionalInteger = (value: unknown, fieldName: string): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const normalized = String(value).trim();

    if (!/^-?\d+$/.test(normalized)) {
        throw new errors.BadRequestError(`${fieldName} is invalid`);
    }

    const parsed = Number(normalized);

    if (!Number.isSafeInteger(parsed)) {
        throw new errors.BadRequestError(`${fieldName} is invalid`);
    }

    return parsed;
};

const parseOptionalNumber = (value: unknown, fieldName: string): number | null => {
    if (value === undefined || value === null || value === '') return null;

    const parsed = Number(String(value).trim());

    if (!Number.isFinite(parsed)) {
        throw new errors.BadRequestError(`${fieldName} is invalid`);
    }

    return parsed;
};

export default (server: Express, oblecto: Oblecto) => {
    server.get('/HLS/:sessionId/segment/:id', async function (req: Request, res: Response, next: NextFunction) {
        try {
            const sessionId = req.params.sessionId;
            logger.debug(`HLS segment request session=${sessionId} segment=${req.params.id}`);

            if (!oblecto.streamSessionController.sessionExists(sessionId)) {
                throw new errors.InvalidCredentialsError('Stream session token does not exist');
            }

            const streamSession = oblecto.streamSessionController.sessions[sessionId];

            if (!(streamSession instanceof HlsStreamSession)) {
                throw new errors.BadRequestError('Invalid stream session type');
            }

            const segmentId = parseInt(req.params.id, 10);

            if (Number.isNaN(segmentId)) {
                throw new errors.BadRequestError('Invalid segment id');
            }

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
            const subtitleModeRaw = ((params.subtitleMode as string) || 'auto').toLowerCase();
            const subtitleMode = ['off', 'auto', 'forced'].includes(subtitleModeRaw)
                ? subtitleModeRaw as 'off' | 'auto' | 'forced'
                : null;
            const requestedAudioStreamIndex = parseOptionalInteger(params.audioStreamIndex, 'audioStreamIndex');
            const requestedSubtitleStreamIndex = parseOptionalInteger(params.subtitleStreamIndex, 'subtitleStreamIndex');

            try {
                file = await File.findByPk(req.params.id, { include: [Stream] });
            } catch (ex) {
                throw new errors.NotFoundError('File does not exist');
            }

            if (!file) throw new errors.NotFoundError('File does not exist');
            if (!subtitleMode) throw new errors.BadRequestError('subtitleMode is invalid');

            const streams: any[] = Array.isArray((file as any).Streams) ? (file as any).Streams : [];
            const audioStreams = streams.filter((stream: any) => stream.codec_type === 'audio');
            const subtitleStreams = streams.filter((stream: any) => stream.codec_type === 'subtitle');

            if (requestedAudioStreamIndex !== null && !audioStreams.some((stream: any) => stream.index === requestedAudioStreamIndex)) {
                throw new errors.BadRequestError('audioStreamIndex is invalid');
            }

            if (requestedSubtitleStreamIndex !== null && requestedSubtitleStreamIndex !== -1 &&
                !subtitleStreams.some((stream: any) => stream.index === requestedSubtitleStreamIndex)) {
                throw new errors.BadRequestError('subtitleStreamIndex is invalid');
            }

            const resolvedAudioStreamIndex = requestedAudioStreamIndex;
            const resolvedSubtitleStreamIndex = subtitleMode === 'off' || requestedSubtitleStreamIndex === -1
                ? null
                : (requestedSubtitleStreamIndex !== null
                    ? requestedSubtitleStreamIndex
                    : null);

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
                offset: parseOptionalNumber(params.offset, 'offset') || 0,
                audioStreamIndex: resolvedAudioStreamIndex ?? undefined,
                subtitleStreamIndex: resolvedSubtitleStreamIndex,
                subtitleMode
            });

            res.send({
                sessionId: streamSession.sessionId,
                seeking: streamSession instanceof DirectHttpStreamSession ? 'client' : 'server',
                outputCodec: {
                    video: streamSession.videoCodec,
                    audio: streamSession.audioCodec
                },
                inputCodec: { video: streamSession.file.videoCodec, audio: streamSession.file.audioCodec },
                selectedTracks: {
                    audioStreamIndex: streamSession.selectedAudioStreamIndex,
                    subtitleStreamIndex: streamSession.selectedSubtitleStreamIndex,
                    subtitleMode: streamSession.subtitleMode
                }
            });
        } catch (error) {
            next(error);
        }
    });

    server.get('/session/stream/:sessionId', async function (req: OblectoRequest, res: Response, next: NextFunction) {
        try {
            logger.debug(`Session stream request session=${req.params.sessionId}`);
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
