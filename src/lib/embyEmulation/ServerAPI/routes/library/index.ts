
export default (server, embyEmulation) => {
    // Collections
    server.get('/collections', async (req, res) => { res.send([]); });
    server.get('/collections/:collectionid/items', async (req, res) => { res.send([]); });

    // Library
    server.get('/library/media/updated', async (req, res) => { res.send([]); });
    server.get('/library/mediafolders', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/library/movies/added', async (req, res) => { res.send([]); });
    server.get('/library/movies/updated', async (req, res) => { res.send([]); });
    server.get('/library/physicalpaths', async (req, res) => { res.send([]); });
    server.post('/library/refresh', async (req, res) => { res.status(204).send(); });
    server.get('/library/series/added', async (req, res) => { res.send([]); });
    server.get('/library/series/updated', async (req, res) => { res.send([]); });
    server.get('/library/virtualfolders', async (req, res) => { res.send([]); });
    server.get('/library/virtualfolders/libraryoptions', async (req, res) => { res.send({}); });
    server.get('/library/virtualfolders/name', async (req, res) => { res.send({}); });
    server.get('/library/virtualfolders/paths', async (req, res) => { res.send([]); });
    server.post('/library/virtualfolders/paths/update', async (req, res) => { res.status(204).send(); });

    // Libraries
    server.get('/libraries/availableoptions', async (req, res) => { res.send({}); });

    // Genres
    server.get('/genres', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/genres/:genrename', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/genres/:name/images/:imagetype', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/genres/:name/images/:imagetype/:imageindex', async (req, res) => { res.status(404).send('Not Found'); });

    // Years
    server.get('/years', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/years/:year', async (req, res) => { res.status(404).send('Not Found'); });

    // Playlists
    server.get('/playlists', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/playlists/:itemid/instantmix', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/playlists/:playlistid', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/playlists/:playlistid/items', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.post('/playlists/:playlistid/items/:itemid/move/:newindex', async (req, res) => { res.status(204).send(); });
    server.get('/playlists/:playlistid/users', async (req, res) => { res.send([]); });
    server.get('/playlists/:playlistid/users/:userid', async (req, res) => { res.status(404).send('Not Found'); });
};
