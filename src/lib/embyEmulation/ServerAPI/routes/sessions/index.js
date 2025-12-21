import { TrackEpisode } from '../../../../../models/trackEpisode';
import { TrackMovie } from '../../../../../models/trackMovie';
import { Episode } from '../../../../../models/episode';
import { Movie } from '../../../../../models/movie';
import { File } from '../../../../../models/file';
import { parseId } from '../../../helpers';

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
        embyEmulation.sessions[req.headers.emby.Token].playSession = req.query;

        console.log(req.query);

        embyEmulation.websocketSessions[req.headers.emby.Token].write({
            MessageType: 'Play',
            Data: req.query
        });

        res.send();
    });

    server.post('/sessions/playing/progress', async (req, res) => {
        if (!req.headers.emby || !req.headers.emby.Token || !embyEmulation.sessions[req.headers.emby.Token]) {
            return res.status(401).send('Unauthorized');
        }

        const session = embyEmulation.sessions[req.headers.emby.Token];
        const userId = session.Id;
        const params = { ...req.query, ...req.body };
        const { ItemId, PositionTicks } = params;

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
};
