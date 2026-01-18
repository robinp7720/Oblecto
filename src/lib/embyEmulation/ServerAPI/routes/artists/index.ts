
export default (server, embyEmulation) => {
    // Artists
    server.get('/artists', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/artists/albumartists', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/artists/instantmix', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/artists/:name', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/artists/:name/images/:imagetype/:imageindex', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/artists/:itemid/instantmix', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/artists/:itemid/similar', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });

    // MusicGenres
    server.get('/musicgenres', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/musicgenres/instantmix', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/musicgenres/:genrename', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/musicgenres/:name/images/:imagetype', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/musicgenres/:name/images/:imagetype/:imageindex', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/musicgenres/:name/instantmix', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });

    // Persons
    server.get('/persons', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/persons/:name', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/persons/:name/images/:imagetype', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/persons/:name/images/:imagetype/:imageindex', async (req, res) => { res.status(404).send('Not Found'); });

    // Studios
    server.get('/studios', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/studios/:name', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/studios/:name/images/:imagetype', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/studios/:name/images/:imagetype/:imageindex', async (req, res) => { res.status(404).send('Not Found'); });

    // Albums
    server.get('/albums/:itemid/instantmix', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/albums/:itemid/similar', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });

    // Songs
    server.get('/songs/:itemid/instantmix', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
};
