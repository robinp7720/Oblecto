export default (server, embyEmulation) => {
    server.get('/system/ping', async (req, res) => {
        res.send();
    });

    server.post('/system/ping', async (req, res) => {
        res.send();
    });
};
