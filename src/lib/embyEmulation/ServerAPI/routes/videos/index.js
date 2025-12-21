import { promises as fs } from 'fs';
import mimeTypes from 'mime-types';
import errors from '../../errors';
import { Movie } from '../../../../../models/movie';
import { Episode } from '../../../../../models/episode';
import { File } from '../../../../../models/file';
import { parseId } from '../../../helpers';
import HLSStreamer from '../../../../streamSessions/StreamSessionTypes/HLSStreamer';

const getQueryValue = (req, key) => {
    const target = key.toLowerCase();

    for (const [name, value] of Object.entries(req.query || {})) {
        if (name.toLowerCase() === target) return value;
    }

    return undefined;
};

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

const resolveFileForItem = async (req, itemId) => {
    const mediaSourceId = getQueryValue(req, 'mediasourceid');

    if (mediaSourceId) {
        return await File.findByPk(mediaSourceId);
    }

    const { id, type } = parseId(itemId);

    if (type === 'movie') {
        const movie = await Movie.findByPk(id, { include: [File] });
        return movie?.Files?.[0] || null;
    }

    if (type === 'episode') {
        const episode = await Episode.findByPk(id, { include: [File] });
        return episode?.Files?.[0] || null;
    }

    return null;
};

const buildStreamTarget = (req, file, fallbackContainer) => {
    const container = normalizeContainer(getQueryValue(req, 'container') || fallbackContainer || file?.extension);
    const segmentContainer = normalizeContainer(getQueryValue(req, 'segmentcontainer'));
    const formats = (segmentContainer || container || 'mp4').toString().split(',');

    const rawVideoCodec = getQueryValue(req, 'videocodec') || file?.videoCodec || 'h264';
    const rawAudioCodec = getQueryValue(req, 'audiocodec') || file?.audioCodec || 'aac';

    return {
        formats,
        videoCodecs: rawVideoCodec.toString().split(','),
        audioCodecs: rawAudioCodec.toString().split(','),
    };
};

const getOffsetSeconds = (req) => {
    const startTicks = getQueryValue(req, 'starttimeticks');
    if (!startTicks) return 0;

    const parsed = Number(startTicks);
    if (!Number.isFinite(parsed)) return 0;

    return parsed / 10000000;
};

const resolveStreamSession = (embyEmulation, req, file, streamType, fallbackContainer) => {
    const controller = embyEmulation.oblecto.streamSessionController;
    const playSessionId = getQueryValue(req, 'playsessionid');

    if (playSessionId && controller.sessionExists(playSessionId)) {
        const existingSession = controller.sessions[playSessionId];

        if (streamType === 'hls') {
            if (existingSession instanceof HLSStreamer) return existingSession;
        } else if (!(existingSession instanceof HLSStreamer)) {
            return existingSession;
        }
    }

    const target = buildStreamTarget(req, file, fallbackContainer);
    const offset = getOffsetSeconds(req);

    return controller.newSession(file, {
        streamType,
        target,
        offset,
    });
};

const ensureHlsSession = (embyEmulation, req, file, itemId, playlistId) => {
    const controller = embyEmulation.oblecto.streamSessionController;
    const playSessionId = getQueryValue(req, 'playsessionid');

    if (playSessionId && controller.sessionExists(playSessionId)) {
        const existingSession = controller.sessions[playSessionId];
        if (existingSession instanceof HLSStreamer) return existingSession;
    }

    embyEmulation.hlsSessionsByItemId = embyEmulation.hlsSessionsByItemId || {};
    embyEmulation.hlsSessionsByPlaylistId = embyEmulation.hlsSessionsByPlaylistId || {};

    const mappedId = (playlistId && embyEmulation.hlsSessionsByPlaylistId[playlistId])
        || embyEmulation.hlsSessionsByItemId[itemId];

    if (mappedId && controller.sessionExists(mappedId)) {
        const existingSession = controller.sessions[mappedId];
        if (existingSession instanceof HLSStreamer) return existingSession;
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

            if (!(streamSession instanceof HLSStreamer)) {
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
            const file = await resolveFileForItem(req, req.params.itemid || req.params.mediaid);

            if (!file) {
                throw errors.NotFoundError('Media source not found');
            }

            const staticRequested = normalizeBool(getQueryValue(req, 'static'));
            const container = normalizeContainer(getQueryValue(req, 'container') || fallbackContainer);
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
            const file = await resolveFileForItem(req, req.params.itemid || req.params.mediaid);

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
            const file = await resolveFileForItem(req, itemId);

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

            if (!streamSession || !(streamSession instanceof HLSStreamer)) {
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
