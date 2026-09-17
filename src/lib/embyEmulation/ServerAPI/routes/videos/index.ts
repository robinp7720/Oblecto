import { randomUUID } from 'node:crypto';
import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';
import { File } from '../../../../../models/file.js';
import { Movie } from '../../../../../models/movie.js';
import { Episode } from '../../../../../models/episode.js';
import { parseId, parseFileId } from '../../../helpers.js';
import { getRequestValue } from '../../requestUtils.js';
import { getPlaybackEntry } from '../../playbackState.js';
import { embyIdentity, embyPlayback } from '../../playback.js';
import { PlaybackError } from '../../../../playback/types.js';

export default (server: Application, emby: EmbyEmulation): void => {
    const handle = async (req: Request, res: Response) => {
        const identity = embyIdentity(emby, req);
        const itemId = String(req.params.itemid ?? req.params.mediaid);
        const { id, type } = parseId(itemId);
        const item = type === 'episode' ? await Episode.findByPk(id, { include: [File] }) : await Movie.findByPk(id, { include: [File] });
        const files = (item?.get('Files') ?? []) as File[];
        const playId = String(getRequestValue(req, 'PlaySessionId') ?? randomUUID());
        const entry = getPlaybackEntry(emby, identity.token, playId);
        const requestedFile = getRequestValue(req, 'MediaSourceId') ?? entry?.mediaSourceId;
        const fileId = requestedFile === undefined ? undefined : parseFileId(String(requestedFile)) ?? Number(requestedFile);
        const file = fileId === undefined ? files[0] : files.find(f => f.id === fileId);
        if (!file) throw new PlaybackError('MEDIA_NOT_FOUND', 'Media source does not belong to this item', 404);
        const session = await embyPlayback(emby, req, file, playId, req.path.endsWith('.m3u8'));
        const description = emby.oblecto.playback.describe(session, '/playback/media');
        // The scoped URL is on this Emby server; no REST-server origin or filesystem path leaks.
        res.redirect(307, description.mediaUrl);
    };
    for (const kind of ['videos', 'audio']) {
        server.get(`/${kind}/:itemid/stream`, handle);
        server.get(`/${kind}/:itemid/stream.:container`, handle);
        for (const playlist of ['master', 'main', 'live']) server.get(`/${kind}/:itemid/${playlist}.m3u8`, handle);
    }
    server.get('/videos/:mediaid/stream/:ext', handle);
    server.get('/playback/media/:id/:revision/:asset', async (req, res) => {
        const session = emby.oblecto.playback.get(String(req.params.id));
        if (req.query.token !== session.token) throw new PlaybackError('UNAUTHORIZED', 'Invalid media token', 401);
        await emby.oblecto.playback.serve(session, Number(req.params.revision), String(req.params.asset), req, res);
    });
};
