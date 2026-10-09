import { saveProgress } from '../../../../playback/progress.js';
import { embyIdentity } from '../../playback.js';
import { Episode } from '../../../../../models/episode';
import { Movie } from '../../../../../models/movie';
import { File } from '../../../../../models/file';
import { parseId } from '../../../helpers';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing */
import { getEmbyToken, getRequestValue } from '../../requestUtils.js';
import { getPlaybackEntry, setLastMediaSource, upsertPlaybackEntry, statisticsPlaybackId, legacyStatisticsId } from '../../playbackState.js';

/**
 * @param server
 * @param embyEmulation
 */
import type { Application, Response } from 'express';
import type EmbyEmulation from '../../../index.js';
import { EmbyRequest } from '../../index.js';

export default (server: Application, embyEmulation: EmbyEmulation): void => {
    server.post('/sessions/capabilities/:type', (req: EmbyRequest, res: Response) => {
        const token = getEmbyToken(req);
        if (token && embyEmulation.sessions[token]) {
            embyEmulation.sessions[token].capabilities = req.query;
        }

        res.send();
    });

    server.post('/sessions/playing', (req, res) => report(req, res, false, true));

    const report = async (req: EmbyRequest, res: Response, stop = false, start = false): Promise<void> => {
        const token = getEmbyToken(req);
        if (!token || !embyEmulation.sessions[token]) { res.status(401).send('Unauthorized'); return; }
        const itemId = getRequestValue(req, 'ItemId');
        if (!itemId) { res.status(400).send('Missing ItemId'); return; }
        const time = Number(getRequestValue(req, 'PositionTicks') ?? 0) / 10000000;
        if (!Number.isFinite(time) || time < 0) { res.status(400).send('Invalid PositionTicks'); return; }
        const suppliedPlayId = getRequestValue(req, 'PlaySessionId');
        const playId = suppliedPlayId || `legacy:${String(itemId)}`;
        let entry = getPlaybackEntry(embyEmulation, token, playId);
        if (entry?.stopped && (!start || suppliedPlayId)) { res.status(204).send(); return; }
        if (!stop || entry) entry = upsertPlaybackEntry(embyEmulation, token, {
            playSessionId: playId,
            itemId: String(itemId),
            stopped: false,
            statisticsId: start && !suppliedPlayId && entry?.stopped ? legacyStatisticsId() : entry?.statisticsId ?? (suppliedPlayId ? statisticsPlaybackId(token, playId) : legacyStatisticsId())
        });
        const mediaSourceId = getRequestValue(req, 'MediaSourceId');
        if (mediaSourceId !== undefined) setLastMediaSource(embyEmulation, token, String(itemId), String(mediaSourceId));
        if (start) (embyEmulation.sessions[token] as any).playSession = { ...req.query, ...req.body };
        const playback = entry?.streamSessionId ? embyEmulation.oblecto.playback?.sessions.get(String(entry.streamSessionId)) : undefined;
        if (playback && playback.owner === `emby:${token}`) {
            await embyEmulation.oblecto.playback.report(playback, {
 revision: playback.revision, position: time, paused: stop || String(getRequestValue(req, 'IsPaused')) === 'true' 
});
            if (stop && String(getRequestValue(req, 'Failed')) === 'true') await embyEmulation.oblecto.statistics?.failure(playback.statisticsId, 'CLIENT_FAILED');
            if (stop) await embyEmulation.oblecto.playback.stop(playback);
        } else {
            const { id, type } = parseId(String(itemId));
            const item = type === 'episode' ? await Episode.findByPk(id, { include: [File] }) : type === 'movie' ? await Movie.findByPk(id, { include: [File] }) : null;
            if (item && (type === 'movie' || type === 'episode')) {
                const files = item.get('Files') as File[] | undefined;
                const file = files?.find(file => String(file.id) === String(mediaSourceId ?? entry?.mediaSourceId)) ?? files?.[0];
                const duration = file?.duration || Number(item.get('runtime')) * 60 || 0;
                if (entry?.statisticsId) {
                    const statistics = embyEmulation.oblecto?.statistics;
                    const statsId = entry.statisticsId;
                    await statistics?.begin(statsId, Number(embyEmulation.sessions[token].Id), file ?? null, 'jellyfin', time, {
                        itemType: type, itemId: id, title: item instanceof Movie ? item.movieName ?? 'Movie' : item.episodeName ?? 'Episode'
                    });
                    const playMethod = String(getRequestValue(req, 'PlayMethod')).toLowerCase();
                    const method = playMethod === 'directplay' ? 'direct' : playMethod === 'directstream' ? 'remux' : playMethod === 'transcode' ? 'transcode' : 'unknown';
                    await statistics?.report(statsId, { position: time, paused: stop || String(getRequestValue(req, 'IsPaused')) === 'true' }, duration, method);
                    if (stop && String(getRequestValue(req, 'Failed')) === 'true') await statistics?.failure(statsId, 'CLIENT_FAILED');
                    if (stop) await statistics?.end(statsId);
                }
                await saveProgress(Number(embyEmulation.sessions[token].Id), type, id, time, duration);
            }
        }
        if (stop && entry) upsertPlaybackEntry(embyEmulation, token, { playSessionId: playId, stopped: true });
        res.status(204).send();
    };
    server.post('/sessions/playing/progress', (req, res) => report(req, res));
    server.post('/sessions/playing/stopped', (req, res) => report(req, res, true));
    server.post('/sessions/playing/ping', (req, res) => {
        const { token, owner } = embyIdentity(embyEmulation, req);
        const entry = getPlaybackEntry(embyEmulation, token, getRequestValue(req, 'PlaySessionId'));
        if (entry?.streamSessionId) embyEmulation.oblecto.playback.get(String(entry.streamSessionId), owner).touch();
        res.status(204).send();
    });
    server.get('/sessions', (req, res) => { res.send([]); });
    server.post('/sessions/:sessionid/command', (req, res) => { res.status(204).send(); });
    server.post('/sessions/:sessionid/command/:command', (req, res) => { res.status(204).send(); });
    server.post('/sessions/:sessionid/message', (req, res) => { res.status(204).send(); });
    server.delete('/sessions/:sessionid/playing', (req, res) => { res.status(204).send(); });
    server.post('/sessions/:sessionid/playing/:command', (req, res) => { res.status(204).send(); });
    server.post('/sessions/:sessionid/system/:command', (req, res) => { res.status(204).send(); });
    server.post('/sessions/:sessionid/user/:userid', (req, res) => { res.status(204).send(); });
    server.post('/sessions/:sessionid/viewing', (req, res) => { res.status(204).send(); });
    server.get('/sessions/capabilities', (req, res) => { res.send({}); });
    server.post('/sessions/capabilities/full', (req, res) => { res.status(204).send(); });
    server.post('/sessions/logout', (req: EmbyRequest, res: Response) => {
        if (req.embyToken) embyEmulation.endSession(req.embyToken, true);
        res.status(204).send();
    });
    server.get('/sessions/viewing', (req, res) => { res.send([]); });

    // SyncPlay
    // Before /syncplay/:id, which would otherwise take "list" as a group id.
    server.get('/syncplay/list', (req, res) => { res.send([]); });
    server.get('/syncplay/:id', (req, res) => { res.status(404).send('Not Found'); });
    server.post('/syncplay/buffering', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/join', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/leave', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/moveplaylistitem', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/new', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/nextitem', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/pause', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/ping', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/previousitem', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/queue', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/ready', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/removefromplaylist', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/seek', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/setignorewait', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/setnewqueue', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/setplaylistitem', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/setrepeatmode', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/setshufflemode', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/stop', (req, res) => { res.status(204).send(); });
    server.post('/syncplay/unpause', (req, res) => { res.status(204).send(); });

    // Playback
    server.get('/playback/bitratetest', (req, res) => { res.send('0'); });

    // PlayingItems
    server.delete('/playingitems/:itemid', (req, res) => { res.status(204).send(); });
    server.post('/playingitems/:itemid/progress', (req, res) => { res.status(204).send(); });
};