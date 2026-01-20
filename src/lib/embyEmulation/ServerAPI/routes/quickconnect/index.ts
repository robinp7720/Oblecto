/**
 * @param server
 * @param embyEmulation
 */
export default (server, embyEmulation) => {
    server.get('/quickconnect/enabled', async (req, res) => {
        res.send(false);
    });

    server.post('/quickconnect/enabled', async (req, res) => {
        embyEmulation.sessions[req.headers.emby.Token].capabilities = req.query;

        res.send(false);
    });

    server.get('/quickconnect/initiate', async (req, res) => { res.status(501).send('Not Implemented'); });
    server.get('/quickconnect/connect', async (req, res) => { res.status(501).send('Not Implemented'); });
    server.post('/quickconnect/authorize', async (req, res) => { res.status(501).send('Not Implemented'); });
};
