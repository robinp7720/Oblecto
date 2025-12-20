/**
 * @param server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.post('/quickconnect/enabled', async (req, res) => {
        embyEmulation.sessions[req.headers.emby.Token].capabilities = req.query;

        res.send(false);
    });
};
