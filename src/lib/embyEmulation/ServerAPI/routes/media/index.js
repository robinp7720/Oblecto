
export default (server, embyEmulation) => {
    // Audio
    server.get('/audio/:itemid/hls/:segmentid/stream.aac', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/hls/:segmentid/stream.mp3', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/lyrics', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/remotesearch/lyrics', async (req, res) => { res.send([]); });
    server.get('/audio/:itemid/remotesearch/lyrics/:lyricid', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/universal', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/stream', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/stream.:container', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/hls1/:playlistid/:segmentid.:container', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/main.m3u8', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/master.m3u8', async (req, res) => { res.status(404).send('Not Found'); });

    // Videos
    server.get('/videos/activeencodings', async (req, res) => { res.send([]); });
    server.get('/videos/mergeversions', async (req, res) => { res.status(204).send(); });
    server.get('/videos/:itemid/additionalparts', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
    server.get('/videos/:itemid/alternatesources', async (req, res) => { res.send([]); });
    server.get('/videos/:itemid/subtitles', async (req, res) => { res.send({}); });
    server.get('/videos/:itemid/subtitles/:index', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/videos/:itemid/trickplay/:width/tiles.m3u8', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/videos/:itemid/trickplay/:width/:index.jpg', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/videos/:itemid/:mediasourceid/subtitles/:index/subtitles.m3u8', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/videos/:videoid/:mediasourceid/attachments/:index', async (req, res) => { res.status(404).send('Not Found'); });
    
    // Complex video routes with many params (simplified stubs)
    server.get('/videos/:routeitemid/:routemediasourceid/subtitles/:routeindex/:routestartpositionticks/stream.:routeformat', async (req, res) => { res.status(404).send('Not Found'); });
    server.get('/videos/:routeitemid/:routemediasourceid/subtitles/:routeindex/stream.:routeformat', async (req, res) => { res.status(404).send('Not Found'); });

    // MediaSegments
    server.get('/mediasegments/:itemid', async (req, res) => { res.send({
        Items: [], TotalRecordCount: 0, StartIndex: 0 
    }); });
};
