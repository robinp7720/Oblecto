import { TrackEpisode } from '../../../../../models/trackEpisode';
import { TrackMovie } from '../../../../../models/trackMovie';
import { Episode } from '../../../../../models/episode';
import { Movie } from '../../../../../models/movie';
import { File } from '../../../../../models/file';
import { parseId } from '../../../helpers';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing */
import { getEmbyToken, getRequestValue } from '../../requestUtils.js';
import { deletePlaybackEntry, setLastMediaSource, upsertPlaybackEntry } from '../../playbackState.js';

/**
 * @param server
 * @param embyEmulation
 */
import type { Application, Response } from 'express';
import type EmbyEmulation from '../../../index.js';
import { EmbyRequest } from '../../index.js';

export default (server: Application, embyEmulation: EmbyEmulation): void => {
    server.post('/sessions/capabilities/:type', async (req: EmbyRequest, res: Response) => {
        const token = getEmbyToken(req);
        if (token && embyEmulation.sessions[token]) {
            embyEmulation.sessions[token].capabilities = req.query;
        }

        res.send();
    });

    server.post('/sessions/playing', async (req: EmbyRequest, res: Response) => {
        const token = getEmbyToken(req);
        const params = { ...req.query, ...req.body };

        if (token && embyEmulation.sessions[token]) {
            (embyEmulation.sessions[token] as any).playSession = params;
        }

        if (token && embyEmulation.websocketSessions[token]) {
            (embyEmulation.websocketSessions[token] as any).write({
                MessageType: 'Play',
                Data: params
            });
        }

        const playSessionId = getRequestValue(req, 'PlaySessionId');
        const mediaSourceId = getRequestValue(req, 'MediaSourceId');

        if (playSessionId && token) {
            upsertPlaybackEntry(embyEmulation as any, token, {
                playSessionId,
                itemId: params.ItemId,
                mediaSourceId
            });
            if (params.ItemId && mediaSourceId !== undefined) {
                setLastMediaSource(embyEmulation as any, token, String(params.ItemId), String(mediaSourceId));
            }
        }

        res.send();
    });

    server.post('/sessions/playing/progress', async (req: EmbyRequest, res: Response) => {
        const token = getEmbyToken(req);

        if (!token || !embyEmulation.sessions[token]) {
            return res.status(401).send('Unauthorized');
        }

        const session = embyEmulation.sessions[token];
        const userId = session.Id;
        const params: any = { ...req.query, ...req.body };
        const { ItemId, PositionTicks } = params;
        const playSessionId = getRequestValue(req, 'PlaySessionId');

        if (playSessionId && token) {
            upsertPlaybackEntry(embyEmulation as any, token, {
                playSessionId,
                itemId: ItemId,
            });
        }

        if (!ItemId) return res.status(400).send('Missing ItemId');

        const { id, type } = parseId(ItemId);
        const time = parseInt(PositionTicks || 0) / 10000000;

        try {
            if (type === 'episode') {
                const episode: any = await Episode.findByPk(id, { include: [File] });

                if (episode) {
                    const duration = episode.Files?.[0]?.duration || (episode.runtime * 60) || 0;
                    const progress = duration > 0 ? time / duration : 0;

                    const [track, created] = await TrackEpisode.findOrCreate({
                        where: { userId, episodeId: id } as any,
                        defaults: {
 time, progress, userId, episodeId: id 
} as any
                    });

                    if (!created) {
                        track.time = time;
                        track.progress = progress;
                        track.changed('updatedAt', true);
                        await track.save();
                    }
                }
            } else if (type === 'movie') {
                const movie: any = await Movie.findByPk(id, { include: [File] });

                if (movie) {
                    const duration = movie.Files?.[0]?.duration || (movie.runtime * 60) || 0;
                    const progress = duration > 0 ? time / duration : 0;

                    const [track, created] = await TrackMovie.findOrCreate({
                        where: { userId, movieId: id } as any,
                        defaults: {
 time, progress, userId, movieId: id 
} as any
                    });

                    if (!created) {
                        track.time = time;
                        track.progress = progress;
                        track.changed('updatedAt', true);
                        await track.save();
                    }
                }
            }
        } catch (error) {
            console.error('Failed to update progress:', error);
        }

        res.status(204).send();
    });

    // Additional Session Routes
    server.post('/sessions/playing/ping', async (req, res) => { res.status(204).send(); });
    server.post('/sessions/playing/stopped', async (req: EmbyRequest, res) => {
        const token = getEmbyToken(req);
        const playSessionId = getRequestValue(req, 'PlaySessionId')
            || (token && embyEmulation.sessions?.[token] ? (embyEmulation.sessions[token] as any).playSession?.PlaySessionId : undefined);

        if (playSessionId && token) {
            deletePlaybackEntry(embyEmulation as any, token, playSessionId);
        }
        res.status(204).send();
    });
    server.get('/sessions', async (req, res) => { res.send([]); });
    server.post('/sessions/:sessionid/command', async (req, res) => { res.status(204).send(); });
    server.post('/sessions/:sessionid/command/:command', async (req, res) => { res.status(204).send(); });
    server.post('/sessions/:sessionid/message', async (req, res) => { res.status(204).send(); });
    server.delete('/sessions/:sessionid/playing', async (req, res) => { res.status(204).send(); });
    server.post('/sessions/:sessionid/playing/:command', async (req, res) => { res.status(204).send(); });
    server.post('/sessions/:sessionid/system/:command', async (req, res) => { res.status(204).send(); });
    server.post('/sessions/:sessionid/user/:userid', async (req, res) => { res.status(204).send(); });
    server.post('/sessions/:sessionid/viewing', async (req, res) => { res.status(204).send(); });
    server.get('/sessions/capabilities', async (req, res) => { res.send({}); });
    server.post('/sessions/capabilities/full', async (req, res) => { res.status(204).send(); });
    server.post('/sessions/logout', async (req, res) => { res.status(204).send(); });
    server.get('/sessions/viewing', async (req, res) => { res.send([]); });

    // SyncPlay
    server.get('/syncplay/:id', async (req, res) => { res.status(404).send('Not Found'); });
    server.post('/syncplay/buffering', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/join', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/leave', async (req, res) => { res.status(204).send(); });
    server.get('/syncplay/list', async (req, res) => { res.send([]); });
    server.post('/syncplay/moveplaylistitem', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/new', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/nextitem', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/pause', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/ping', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/previousitem', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/queue', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/ready', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/removefromplaylist', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/seek', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/setignorewait', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/setnewqueue', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/setplaylistitem', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/setrepeatmode', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/setshufflemode', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/stop', async (req, res) => { res.status(204).send(); });
    server.post('/syncplay/unpause', async (req, res) => { res.status(204).send(); });

    // Playback
    server.get('/playback/bitratetest', async (req, res) => { res.send('0'); });

    // PlayingItems
    server.delete('/playingitems/:itemid', async (req, res) => { res.status(204).send(); });
    server.post('/playingitems/:itemid/progress', async (req, res) => { res.status(204).send(); });
};