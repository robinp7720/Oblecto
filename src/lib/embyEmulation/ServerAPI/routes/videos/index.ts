import { promises as fs } from 'fs';
import mimeTypes from 'mime-types';
import errors from '../../errors';
import { Movie } from '../../../../../models/movie';
import { Episode } from '../../../../../models/episode';
import { File } from '../../../../../models/file';
import { parseFileId, parseId } from '../../../helpers';
import { HlsStreamSession } from '../../../../mediaSessions/index.js';
import logger from '../../../../../submodules/logger';
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/prefer-nullish-coalescing */
import { getEmbyToken, getRequestValue } from '../../requestUtils.js';
import { getLastMediaSource, getPlaybackEntry, upsertPlaybackEntry } from '../../playbackState.js';

const normalizeBool = (value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

const normalizeContainer = (value) => {
    if (!value) return null;
    const container = String(value).toLowerCase();

    if (container === 'ts') return 'mpegts';
    return container;
};

const resolveFileForItem = async (embyEmulation, req, itemId) => {
    const token = getEmbyToken(req);
    const mediaSourceId = getRequestValue(req, 'MediaSourceId');
    const playSessionId = getRequestValue(req, 'PlaySessionId');
    const playbackSession = playSessionId ? getPlaybackEntry(embyEmulation, token, playSessionId) : null;
    const lastMediaSource = getLastMediaSource(embyEmulation, token, itemId);
    const resolvedMediaSourceId = mediaSourceId ?? playbackSession?.mediaSourceId ?? lastMediaSource;

    if (resolvedMediaSourceId) {
        const parsedMediaSourceId = parseFileId(resolvedMediaSourceId);

        return await File.findByPk(parsedMediaSourceId ?? resolvedMediaSourceId);
    }

    const parsed = parseId(itemId);
    const numericId = parsed.id;
    const type = parsed.type;

    if (type === 'movie') {
        const movie = await Movie.findByPk(numericId, { include: [File] });

        return movie?.Files?.[0] || null;
    }

    if (type === 'episode') {
        const episode = await Episode.findByPk(numericId, { include: [File] });

        logger.debug('Jellyfin emulation: episode stream lookup', {
            episodeId: numericId,
            fileCount: episode?.Files?.length || 0
        });

        if (!episode?.Files?.[0]) {
            logger.warn('Jellyfin emulation: episode media source not found', { episodeId: numericId });
        }

        return episode?.Files?.[0] || null;
    }

    if (type === 'unknown' && Number.isFinite(numericId)) {
        const movie = await Movie.findByPk(numericId, { include: [File] });

        if (movie?.Files?.[0]) return movie.Files[0];

        const episode = await Episode.findByPk(numericId, { include: [File] });

        logger.debug('Jellyfin emulation: unknown item stream lookup', {
            itemId: numericId,
            episodeFileCount: episode?.Files?.length || 0
        });

        if (!episode?.Files?.[0]) {
            logger.warn('Jellyfin emulation: unknown item media source not found', { itemId: numericId });
        }

        return episode?.Files?.[0] || null;
    }

    return null;
};

const buildStreamTarget = (req, file, fallbackContainer) => {
    const container = normalizeContainer(getRequestValue(req, 'Container') || fallbackContainer || file?.extension);
    const segmentContainer = normalizeContainer(getRequestValue(req, 'SegmentContainer'));
    const formats = (segmentContainer || container || 'mp4').toString().split(',');

    const rawVideoCodec = getRequestValue(req, 'VideoCodec') || file?.videoCodec || 'h264';
    const rawAudioCodec = getRequestValue(req, 'AudioCodec') || file?.audioCodec || 'aac';

    return {
        formats,
        videoCodecs: rawVideoCodec.toString().split(','),
        audioCodecs: rawAudioCodec.toString().split(','),
    };
};

const getOffsetSeconds = (req) => {
    const startTicks = getRequestValue(req, 'StartTimeTicks');

    if (!startTicks) return 0;

    const parsed = Number(startTicks);

    if (!Number.isFinite(parsed)) return 0;

    return parsed / 10000000;
};

const resolveStreamSession = (embyEmulation, req, file, streamType, fallbackContainer) => {
    const controller = embyEmulation.oblecto.streamSessionController;
    const playSessionId = getRequestValue(req, 'PlaySessionId');
    const token = getEmbyToken(req);
    const playbackSession = playSessionId ? getPlaybackEntry(embyEmulation, token, playSessionId) : null;
    const existingSessionId = playbackSession?.streamSessionId || playSessionId;

    if (existingSessionId && controller.sessionExists(existingSessionId)) {
        const existingSession = controller.sessions[existingSessionId];

        if (streamType === 'hls') {
            if (existingSession instanceof HlsStreamSession) return existingSession;
        } else if (!(existingSession instanceof HlsStreamSession)) {
            return existingSession;
        }
    }

    const target = buildStreamTarget(req, file, fallbackContainer);
    const offset = getOffsetSeconds(req);

    const session = controller.newSession(file, {
        streamType,
        target,
        offset,
    });

    if (playSessionId) {
        upsertPlaybackEntry(embyEmulation, token, {
            playSessionId,
            streamSessionId: session.sessionId
        });
    }
    return session;
};

const ensureHlsSession = (embyEmulation, req, file, itemId, playlistId) => {
    const controller = embyEmulation.oblecto.streamSessionController;
    const playSessionId = getRequestValue(req, 'PlaySessionId');
    const token = getEmbyToken(req);
    const playbackSession = playSessionId ? getPlaybackEntry(embyEmulation, token, playSessionId) : null;
    const existingSessionId = playbackSession?.streamSessionId || playSessionId;

    if (existingSessionId && controller.sessionExists(existingSessionId)) {
        const existingSession = controller.sessions[existingSessionId];

        if (existingSession instanceof HlsStreamSession) return existingSession;
    }

    embyEmulation.hlsSessionsByItemId = embyEmulation.hlsSessionsByItemId || {};
    embyEmulation.hlsSessionsByPlaylistId = embyEmulation.hlsSessionsByPlaylistId || {};

    const mappedId = (playlistId && embyEmulation.hlsSessionsByPlaylistId[playlistId])
        || embyEmulation.hlsSessionsByItemId[itemId];

    if (mappedId && controller.sessionExists(mappedId)) {
        const existingSession = controller.sessions[mappedId];

        if (existingSession instanceof HlsStreamSession) return existingSession;
    }

    if (!file) return null;

    const target = buildStreamTarget(req, file, 'mpegts');
    const offset = getOffsetSeconds(req);

    const session = controller.newSession(file, {
        streamType: 'hls',
        target,
        offset,
    });

    embyEmulation.hlsSessionsByItemId[itemId] = session.sessionId;
    if (playlistId) {
        embyEmulation.hlsSessionsByPlaylistId[playlistId] = session.sessionId;
    }
    if (playSessionId) {
        upsertPlaybackEntry(embyEmulation, token, {
            playSessionId,
            streamSessionId: session.sessionId
        });
    }

    return session;
};

const sendHead = async (res, file) => {
    const path = file instanceof File ? file.path : file;
    let size = file instanceof File ? file.size : null;

    if (!size) {
        size = (await fs.stat(path)).size;
    }
    const mimeType = mimeTypes.lookup(path) || 'application/octet-stream';

    res.writeHead(200, {
        'Content-Length': size,
        'Accept-Ranges': 'bytes',
        'Content-Type': mimeType,
    });

    res.end();
};

export default (server, embyEmulation) => {
    server.get('/hls/:sessionid/segment/:id', async (req, res, next) => {
        try {
            const sessionId = req.params.sessionid;

            if (!embyEmulation.oblecto.streamSessionController.sessionExists(sessionId)) {
                throw errors.InvalidCredentialsError('Stream session token does not exist');
            }

            const streamSession = embyEmulation.oblecto.streamSessionController.sessions[sessionId];

            if (!(streamSession instanceof HlsStreamSession)) {
                throw errors.BadRequestError('Invalid stream session type');
            }

            const segmentId = parseInt(req.params.id, 10);

            if (Number.isNaN(segmentId)) {
                throw errors.BadRequestError('Invalid segment id');
            }

            await streamSession.streamSegment(req, res, segmentId);
        } catch (error) {
            next(error);
        }
    });

    const handleStreamRequest = async (req, res, next, fallbackContainer) => {
        try {
            const file = await resolveFileForItem(embyEmulation, req, req.params.itemid || req.params.mediaid);

            if (!file) {
                throw errors.NotFoundError('Media source not found');
            }

            const staticRequested = normalizeBool(getRequestValue(req, 'Static'));
            const container = normalizeContainer(getRequestValue(req, 'Container') || fallbackContainer);
            const fileContainer = normalizeContainer(file.extension || file.container);

            let streamType = 'directhttp';

            if (!staticRequested && container && fileContainer && container !== fileContainer) {
                streamType = 'recode';
            }

            const streamSession = resolveStreamSession(embyEmulation, req, file, streamType, container);

            await streamSession.addDestination({
                request: req,
                stream: res,
                type: 'http',
            });

            await streamSession.startStream();
        } catch (error) {
            next(error);
        }
    };

    const handleStreamHead = async (req, res, next) => {
        try {
            const file = await resolveFileForItem(embyEmulation, req, req.params.itemid || req.params.mediaid);

            if (!file) {
                throw errors.NotFoundError('Media source not found');
            }

            await sendHead(res, file);
        } catch (error) {
            next(error);
        }
    };

    const handleHlsPlaylist = async (req, res, next) => {
        try {
            const itemId = req.params.itemid;
            const playlistId = req.params.playlistid;
            const file = await resolveFileForItem(embyEmulation, req, itemId);

            if (!file) {
                throw errors.NotFoundError('Media source not found');
            }

            const streamSession = ensureHlsSession(embyEmulation, req, file, itemId, playlistId);

            await streamSession.addDestination({
                request: req,
                stream: res,
                type: 'http',
            });

            await streamSession.startStream();
        } catch (error) {
            next(error);
        }
    };

    const handleHlsSegment = async (req, res, next) => {
        try {
            const itemId = req.params.itemid;
            const playlistId = req.params.playlistid;
            const segmentId = parseInt(req.params.segmentid, 10);

            if (Number.isNaN(segmentId)) {
                throw errors.BadRequestError('Invalid segment id');
            }

            const streamSession = ensureHlsSession(embyEmulation, req, null, itemId, playlistId);

            if (!streamSession || !(streamSession instanceof HlsStreamSession)) {
                throw errors.BadRequestError('Invalid stream session type');
            }

            await streamSession.streamSegment(req, res, segmentId);
        } catch (error) {
            next(error);
        }
    };

    server.get('/videos/:itemid/stream', (req, res, next) => handleStreamRequest(req, res, next));
    server.head('/videos/:itemid/stream', handleStreamHead);

    server.get('/videos/:itemid/stream.:container', (req, res, next) => handleStreamRequest(req, res, next, req.params.container));
    server.head('/videos/:itemid/stream.:container', handleStreamHead);

    server.get('/audio/:itemid/stream', (req, res, next) => handleStreamRequest(req, res, next));
    server.head('/audio/:itemid/stream', handleStreamHead);

    server.get('/audio/:itemid/stream.:container', (req, res, next) => handleStreamRequest(req, res, next, req.params.container));
    server.head('/audio/:itemid/stream.:container', handleStreamHead);

    server.get('/audio/:itemid/main.m3u8', handleHlsPlaylist);
    server.get('/audio/:itemid/master.m3u8', handleHlsPlaylist);
    server.get('/audio/:itemid/hls1/:playlistid/:segmentid.:container', handleHlsSegment);

    server.get('/videos/:itemid/main.m3u8', handleHlsPlaylist);
    server.get('/videos/:itemid/master.m3u8', handleHlsPlaylist);
    server.get('/videos/:itemid/live.m3u8', handleHlsPlaylist);
    server.get('/videos/:itemid/hls/:playlistid/stream.m3u8', handleHlsPlaylist);

    server.get('/videos/:itemid/hls/:playlistid/:segmentid.:segmentcontainer', handleHlsSegment);
    server.get('/videos/:itemid/hls1/:playlistid/:segmentid.:container', handleHlsSegment);

    server.get('/videos/:mediaid/stream/:ext', async (req, res, next) => {
        await handleStreamRequest(req, res, next, req.params.ext);
    });
};
