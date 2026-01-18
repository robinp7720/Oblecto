import { TrackEpisode } from '../../../../../models/trackEpisode';
import { TrackMovie } from '../../../../../models/trackMovie';
import { Episode } from '../../../../../models/episode';
import { Movie } from '../../../../../models/movie';
import { File } from '../../../../../models/file';
import { parseId } from '../../../helpers';
import { getEmbyToken, getRequestValue } from '../../requestUtils.js';
import { deletePlaybackEntry, setLastMediaSource, upsertPlaybackEntry } from '../../playbackState.js';

/**
 * @param {rest} server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.post('/sessions/capabilities/:type', async (req, res) => {
        embyEmulation.sessions[req.headers.emby.Token].capabilities = req.query;

        res.send();
    });

    server.post('/sessions/playing', async (req, res) => {
        const token = getEmbyToken(req);
        const params = { ...req.query, ...req.body };

        if (token && embyEmulation.sessions[token]) {
            embyEmulation.sessions[token].playSession = params;
        }

        if (token && embyEmulation.websocketSessions[token]) {
            embyEmulation.websocketSessions[token].write({
                MessageType: 'Play',
                Data: params
            });
        }

        const playSessionId = getRequestValue(req, 'PlaySessionId');
        const mediaSourceId = getRequestValue(req, 'MediaSourceId');

        if (playSessionId) {
            upsertPlaybackEntry(embyEmulation, token, {
                playSessionId,
                itemId: params.ItemId,
                mediaSourceId
            });
            if (params.ItemId && mediaSourceId !== undefined) {
                setLastMediaSource(embyEmulation, token, params.ItemId, mediaSourceId);
            }
        }

        res.send();
    });

    server.post('/sessions/playing/progress', async (req, res) => {
        const token = getEmbyToken(req);

        if (!token || !embyEmulation.sessions[token]) {
            return res.status(401).send('Unauthorized');
        }

        const session = embyEmulation.sessions[token];
        const userId = session.Id;
        const params = { ...req.query, ...req.body };
        const { ItemId, PositionTicks } = params;
        const playSessionId = getRequestValue(req, 'PlaySessionId');

        if (playSessionId) {
            upsertPlaybackEntry(embyEmulation, token, {
                playSessionId,
                itemId: ItemId,
            });
        }

        if (!ItemId) return res.status(400).send('Missing ItemId');

        const { id, type } = parseId(ItemId);
        const time = parseInt(PositionTicks || 0) / 10000000;

        try {
            if (type === 'episode') {
                const episode = await Episode.findByPk(id, { include: [File] });

                if (episode) {
                    const duration = episode.Files?.[0]?.duration || (episode.runtime * 60) || 0;
                    const progress = duration > 0 ? time / duration : 0;

                    const [track, created] = await TrackEpisode.findOrCreate({
                        where: { userId, EpisodeId: id },
                        defaults: { time, progress }
                    });

                    if (!created) {
                        track.time = time;
                        track.progress = progress;
                        track.changed('updatedAt', true);
                        await track.save();
                    }
                }
            } else if (type === 'movie') {
                const movie = await Movie.findByPk(id, { include: [File] });

                if (movie) {
                    const duration = movie.Files?.[0]?.duration || (movie.runtime * 60) || 0;
                    const progress = duration > 0 ? time / duration : 0;

                    const [track, created] = await TrackMovie.findOrCreate({
                        where: { userId, MovieId: id },
                        defaults: { time, progress }
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
    server.post('/sessions/playing/stopped', async (req, res) => {
        const token = getEmbyToken(req);
        const playSessionId = getRequestValue(req, 'PlaySessionId')
            || embyEmulation.sessions?.[token]?.playSession?.PlaySessionId;

        if (playSessionId) {
            deletePlaybackEntry(embyEmulation, token, playSessionId);
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
