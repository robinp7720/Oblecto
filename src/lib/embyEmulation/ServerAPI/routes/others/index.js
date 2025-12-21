
export default (server, embyEmulation) => {
    // Environment
    server.get('/environment/defaultdirectorybrowser', async (req, res) => { res.send({}); });
    server.get('/environment/directorycontents', async (req, res) => { res.send([]); });
    server.get('/environment/drives', async (req, res) => { res.send([]); });
    server.get('/environment/networkshares', async (req, res) => { res.send([]); });
    server.get('/environment/parentpath', async (req, res) => { res.send(''); });
    server.post('/environment/validatepath', async (req, res) => { res.status(204).send(); });

    // ScheduledTasks
    server.get('/scheduledtasks/:taskid', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/scheduledtasks/:taskid/triggers', async (req, res) => { res.send([]); });
    server.post('/scheduledtasks/running/:taskid', async (req, res) => { res.status(204).send(); });
    // Note: /scheduledtasks is already in main index.js, need to check if it conflicts or I should remove it there.
    // The main index.js has: server.get('/scheduledtasks', async (req, res) => { res.send({}); });

    // Startup
    server.get('/startup/complete', async (req, res) => { res.status(204).send(); });
    server.get('/startup/configuration', async (req, res) => { res.send({}); });
    server.get('/startup/firstuser', async (req, res) => { res.send({}); });
    server.get('/startup/remoteaccess', async (req, res) => { res.send({}); });
    server.get('/startup/user', async (req, res) => { res.send({}); });

    // FallbackFont
    server.get('/fallbackfont/fonts', async (req, res) => { res.send([]); });
    server.get('/fallbackfont/fonts/:name', async (req, res) => { res.status(404).send('Not Found'); });

    // GetUtcTime
    server.get('/getutctime', async (req, res) => { res.send(new Date().toISOString()); });

    // Tmdb
    server.get('/tmdb/clientconfiguration', async (req, res) => { res.send({}); });
};
