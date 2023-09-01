import ping from './ping';
import info from './info';

export default (server, embyEmulation) => {
    ping(server, embyEmulation);
    info(server, embyEmulation);

    server.get('/system/endpoint', async (req, res) => {
        res.send({
            IsLocal: true,
            IsInNetwork: true
        });
    });
};
