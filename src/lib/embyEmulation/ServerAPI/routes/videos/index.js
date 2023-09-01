import { Movie } from '../../../../../models/movie';
import { File } from '../../../../../models/file';
import { Stream } from '../../../../../models/stream';
import errors from 'restify-errors';

export default (server, embyEmulation) => {
    server.get('/videos/:mediaid/stream.:ext', async (req, res) => {
        console.log('We get to here');

        if (!embyEmulation.oblecto.streamSessionController.sessionExists(req.params.mediasourceid)) {
            console.log('The stream session doesn\'t exist');
            return new errors.InvalidCredentialsError('Stream session token does not exist');
        }

        console.log(req.params.mediasourceid);

        let streamSession = embyEmulation.oblecto.streamSessionController.sessions[req.params.mediasourceid];

        await streamSession.addDestination({
            request: req,
            stream: res,

            type: 'http'
        });

        console.log('Starting stream');

        await streamSession.startStream();
    });
};
