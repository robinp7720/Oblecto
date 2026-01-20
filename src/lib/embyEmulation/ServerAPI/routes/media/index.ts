import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    // Audio
    server.get('/audio/:itemid/hls/:segmentid/stream.aac', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/hls/:segmentid/stream.mp3', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/lyrics', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/remotesearch/lyrics', (_req: Request, res: Response) => { res.send([]); });
    server.get('/audio/:itemid/remotesearch/lyrics/:lyricid', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/universal', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/stream', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/stream.:container', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/hls1/:playlistid/:segmentid.:container', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/main.m3u8', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/audio/:itemid/master.m3u8', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });

    // Videos
    server.get('/videos/activeencodings', (_req: Request, res: Response) => { res.send([]); });
    server.get('/videos/mergeversions', (_req: Request, res: Response) => { res.status(204).send(); });
    server.get('/videos/:itemid/additionalparts', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/videos/:itemid/alternatesources', (_req: Request, res: Response) => { res.send([]); });
    server.get('/videos/:itemid/subtitles', (_req: Request, res: Response) => { res.send({}); });
    server.get('/videos/:itemid/subtitles/:index', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/videos/:itemid/trickplay/:width/tiles.m3u8', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/videos/:itemid/trickplay/:width/:index.jpg', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/videos/:itemid/:mediasourceid/subtitles/:index/subtitles.m3u8', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/videos/:videoid/:mediasourceid/attachments/:index', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });

    // Complex video routes with many params (simplified stubs)
    server.get('/videos/:routeitemid/:routemediasourceid/subtitles/:routeindex/:routestartpositionticks/stream.:routeformat', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/videos/:routeitemid/:routemediasourceid/subtitles/:routeindex/stream.:routeformat', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });

    // MediaSegments
    server.get('/mediasegments/:itemid', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
};
