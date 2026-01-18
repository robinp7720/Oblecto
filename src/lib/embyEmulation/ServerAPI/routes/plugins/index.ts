
export default (server, embyEmulation) => {
    // Plugins
    server.get('/plugins', async (req, res) => { res.send([]); });
    server.get('/plugins/:pluginid/configuration', async (req, res) => { res.send({}); });
    server.get('/plugins/:pluginid/manifest', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/plugins/:pluginid/:version', async (req, res) => { res.status(404).send('Not Found'); });
    server.post('/plugins/:pluginid/:version/disable', async (req, res) => { res.status(204).send(); });
    server.post('/plugins/:pluginid/:version/enable', async (req, res) => { res.status(204).send(); });
    server.get('/plugins/:pluginid/:version/image', async (req, res) => { res.status(404).send('Not Found'); });

    // Packages
    server.get('/packages', async (req, res) => { res.send([]); });
    server.get('/packages/:name', async (req, res) => { res.send([]); });
    server.get('/packages/installed/:name', async (req, res) => { res.send([]); });
    server.post('/packages/installing/:packageid', async (req, res) => { res.status(204).send(); });

    // Repositories
    server.get('/repositories', async (req, res) => { res.send([]); });
    server.post('/repositories', async (req, res) => { res.status(204).send(); }); // Guessing post exists for adding
};
