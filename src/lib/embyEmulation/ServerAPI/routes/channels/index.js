
export default (server, embyEmulation) => {
    // Channels
    server.get('/channels', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/channels/features', async (req, res) => { res.send([]); });
    server.get('/channels/items/latest', async (req, res) => { res.send([]); });
    server.get('/channels/:channelid/features', async (req, res) => { res.send({}); });
    server.get('/channels/:channelid/items', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });

    // LiveTv
    server.get('/livetv/channelmappingoptions', async (req, res) => { res.send({}); });
    server.get('/livetv/channelmappings', async (req, res) => { res.send({}); });
    server.get('/livetv/channels', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/livetv/channels/:channelid', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/livetv/guideinfo', async (req, res) => { res.send({}); });
    server.get('/livetv/info', async (req, res) => { res.send({}); });
    server.get('/livetv/listingproviders', async (req, res) => { res.send([]); });
    server.get('/livetv/listingproviders/default', async (req, res) => { res.send({}); });
    server.get('/livetv/listingproviders/lineups', async (req, res) => { res.send([]); });
    server.get('/livetv/listingproviders/schedulesdirect/countries', async (req, res) => { res.send([]); });
    server.get('/livetv/liverecordings/:recordingid/stream', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/livetv/livestreamfiles/:streamid/stream.:container', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/livetv/programs', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/livetv/programs/:programid', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/livetv/recordings', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/livetv/recordings/folders', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/livetv/recordings/groups', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/livetv/recordings/series', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/livetv/recordings/groups/:groupid', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/livetv/recordings/:recordingid', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/livetv/seriestimers', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/livetv/seriestimers/:timerid', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/livetv/timers', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/livetv/timers/defaults', async (req, res) => { res.send({}); });
    server.get('/livetv/timers/:timerid', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/livetv/tunerhosts', async (req, res) => { res.send([]); });
    server.get('/livetv/tunerhosts/types', async (req, res) => { res.send([]); });
    server.get('/livetv/tuners/discover', async (req, res) => { res.send([]); });
    server.get('/livetv/tuners/discvover', async (req, res) => { res.send([]); }); // Typo in spec?
    server.post('/livetv/tuners/:tunerid/reset', async (req, res) => { res.status(204).send(); });

    // LiveStreams
    server.post('/livestreams/close', async (req, res) => { res.status(204).send(); });
    server.post('/livestreams/open', async (req, res) => { res.send({}); });
};
