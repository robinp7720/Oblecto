export default (server, embyEmulation) => {
    server.get('/system/ping', async (req, res, next) => {
        res.send();

        next();
    });

    server.post('/system/ping', async (req, res, next) => {
        res.send();

        next();
    });
};
