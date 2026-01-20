import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../index.js';

export default (server: Application, _embyEmulation: EmbyEmulation): void => {
    // Collections
    server.get('/collections', (_req: Request, res: Response) => { res.send([]); });
    server.get('/collections/:collectionid/items', (_req: Request, res: Response) => { res.send([]); });

    // Library
    server.get('/library/media/updated', (_req: Request, res: Response) => { res.send([]); });
    server.get('/library/mediafolders', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/library/movies/added', (_req: Request, res: Response) => { res.send([]); });
    server.get('/library/movies/updated', (_req: Request, res: Response) => { res.send([]); });
    server.get('/library/physicalpaths', (_req: Request, res: Response) => { res.send([]); });
    server.post('/library/refresh', (_req: Request, res: Response) => { res.status(204).send(); });
    server.get('/library/series/added', (_req: Request, res: Response) => { res.send([]); });
    server.get('/library/series/updated', (_req: Request, res: Response) => { res.send([]); });
    server.get('/library/virtualfolders', (_req: Request, res: Response) => { res.send([]); });
    server.get('/library/virtualfolders/libraryoptions', (_req: Request, res: Response) => { res.send({}); });
    server.get('/library/virtualfolders/name', (_req: Request, res: Response) => { res.send({}); });
    server.get('/library/virtualfolders/paths', (_req: Request, res: Response) => { res.send([]); });
    server.post('/library/virtualfolders/paths/update', (_req: Request, res: Response) => { res.status(204).send(); });

    // Libraries
    server.get('/libraries/availableoptions', (_req: Request, res: Response) => { res.send({}); });

    // Genres
    server.get('/genres', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/genres/:genrename', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/genres/:name/images/:imagetype', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/genres/:name/images/:imagetype/:imageindex', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });

    // Years
    server.get('/years', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/years/:year', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });

    // Playlists
    server.get('/playlists', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/playlists/:itemid/instantmix', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.get('/playlists/:playlistid', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
    server.get('/playlists/:playlistid/items', (_req: Request, res: Response) => {
        res.send({
            Items: [], TotalRecordCount: 0, StartIndex: 0
        });
    });
    server.post('/playlists/:playlistid/items/:itemid/move/:newindex', (_req: Request, res: Response) => { res.status(204).send(); });
    server.get('/playlists/:playlistid/users', (_req: Request, res: Response) => { res.send([]); });
    server.get('/playlists/:playlistid/users/:userid', (_req: Request, res: Response) => { res.status(404).send('Not Found'); });
};
