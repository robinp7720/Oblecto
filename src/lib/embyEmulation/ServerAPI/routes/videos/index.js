import { Movie } from '../../../../../models/movie';
import { File } from '../../../../../models/file';
import { Stream } from '../../../../../models/stream';
import errors from '../../errors';
import DirectHttpStreamSession from '../../../../streamSessions/StreamSessionTypes/DirectHttpStreamSession';

export default (server, embyEmulation) => {
    server.get('/videos/:mediaid/stream/:ext', async (req, res) => {
        // if (!embyEmulation.oblecto.streamSessionController.sessionExists(req.params.mediasourceid)) {
        //    console.log('The stream session doesn\'t exist');
        //    return new errors.InvalidCredentialsError('Stream session token does not exist');
        // }

        const file = await File.findByPk(req.params.mediasourceid);

        await DirectHttpStreamSession.httpStreamHandler(req, res, file);
    });
};
