/**
 * @param {*} server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.post('/sessions/capabilities/:type', async (req, res, next) => {
        embyEmulation.sessions[req.headers.emby.Token] = req.params;

        res.send();

        next();
    });

    server.post('/sessions/playing', async (req, res, next) => {
        embyEmulation.sessions[req.headers.emby.Token].playSession = req.params;

        console.log(req.params);

        embyEmulation.websocketSessions[req.headers.emby.Token].write({
            MessageType: 'Play',
            Data: req.params
        });

        res.send();

        next();
    });
};
