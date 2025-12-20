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
};
