import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    // Channels
    server.get('/channels', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/channels/features', (_req: Request, res: Response) => { res.send([]); });
    server.get('/channels/items/latest', (_req: Request, res: Response) => { res.send([]); });
    server.get('/channels/:channelid/features', (_req: Request, res: Response) => { res.send({}); });
    server.get('/channels/:channelid/items', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });

    // LiveTv
    server.get('/livetv/channelmappingoptions', (_req: Request, res: Response) => { res.send({}); });
    server.get('/livetv/channelmappings', (_req: Request, res: Response) => { res.send({}); });
    server.get('/livetv/channels', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/livetv/channels/:channelid', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/livetv/guideinfo', (_req: Request, res: Response) => { res.send({}); });
    server.get('/livetv/info', (_req: Request, res: Response) => { res.send({}); });
    server.get('/livetv/listingproviders', (_req: Request, res: Response) => { res.send([]); });
    server.get('/livetv/listingproviders/default', (_req: Request, res: Response) => { res.send({}); });
    server.get('/livetv/listingproviders/lineups', (_req: Request, res: Response) => { res.send([]); });
    server.get('/livetv/listingproviders/schedulesdirect/countries', (_req: Request, res: Response) => { res.send([]); });
    server.get('/livetv/liverecordings/:recordingid/stream', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/livetv/livestreamfiles/:streamid/stream.:container', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/livetv/programs', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/livetv/programs/:programid', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/livetv/recordings', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/livetv/recordings/folders', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/livetv/recordings/groups', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/livetv/recordings/series', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/livetv/recordings/groups/:groupid', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/livetv/recordings/:recordingid', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/livetv/seriestimers', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/livetv/seriestimers/:timerid', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/livetv/timers', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/livetv/timers/defaults', (_req: Request, res: Response) => { res.send({}); });
    server.get('/livetv/timers/:timerid', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/livetv/tunerhosts', (_req: Request, res: Response) => { res.send([]); });
    server.get('/livetv/tunerhosts/types', (_req: Request, res: Response) => { res.send([]); });
    server.get('/livetv/tuners/discover', (_req: Request, res: Response) => { res.send([]); });
    server.get('/livetv/tuners/discvover', (_req: Request, res: Response) => { res.send([]); }); // Typo in spec?
    server.post('/livetv/tuners/:tunerid/reset', (_req: Request, res: Response) => { res.status(204).send(); });

    // LiveStreams
    server.post('/livestreams/close', (_req: Request, res: Response) => { res.status(204).send(); });
    server.post('/livestreams/open', (_req: Request, res: Response) => { res.send({}); });
};
