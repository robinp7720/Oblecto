export default (server, embyEmulation) => {
    server.get('/devices', async (req, res) => {
        res.send({
            Items: [],
            TotalRecordCount: 0,
            StartIndex: 0
        });
    });

    server.get('/devices/info', async (req, res) => { res.send({}); });
    server.get('/devices/options', async (req, res) => { res.send({}); });
};
