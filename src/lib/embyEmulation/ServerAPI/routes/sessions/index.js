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
};
