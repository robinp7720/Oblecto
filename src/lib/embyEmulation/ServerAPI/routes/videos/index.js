import { Movie } from '../../../../../models/movie';
import { File } from '../../../../../models/file';
import { Stream } from '../../../../../models/stream';

export default (server, embyEmulation) => {
    server.get('/videos/:mediaid/stream.mp4', async (req, res) => {
        let movie = await Movie.findByPk(req.params.mediaid.replace('movie', ''), { include: [{ model: File, include: [{ model: Stream }] }] });

        const streamSession = embyEmulation.oblecto.streamSessionController.newSession(movie.Files[0],
            { streamType: 'directhttp' });

        await streamSession.addDestination({
            request: req,
            stream: res,

            type: 'http'
        });

        await streamSession.startStream();
    });
};
