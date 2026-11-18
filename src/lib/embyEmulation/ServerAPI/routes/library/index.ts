import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';
import type { EmbyRequest } from '../../index.js';
import { embyUserCan } from '../../permission.js';
import { maintenanceWork } from '../../../../maintenance/dispatch.js';
import { getRequestList, getRequestValue } from '../../requestUtils.js';
import { allGenres, formatGenre } from '../../library.js';
import { Movie } from '../../../../../models/movie.js';
import { Series } from '../../../../../models/series.js';
import { Episode } from '../../../../../models/episode.js';
import { File } from '../../../../../models/file.js';
import { join } from 'node:path';
import { mkdir, rename } from 'node:fs/promises';

export default (server: Application, embyEmulation: EmbyEmulation): void => {
    // Collections
    const cleanup = async (type: 'movie' | 'series', groupBy: string[], separateSeasons: boolean): Promise<void> => {
        const root = type === 'movie' ? embyEmulation.oblecto.config.movies : embyEmulation.oblecto.config.series;
        if (!root) return;
        const items = type === 'movie'
            ? await Movie.findAll({ include: [File] })
            : await Series.findAll({ include: [{ model: Episode, include: [File] }] });
        for (const item of items) {
            const episodes = type === 'series' ? (item.get('Episodes') as Episode[] | undefined) ?? [] : [];
            const files = type === 'movie' ? (item.get('Files') as File[] | undefined) ?? [] : episodes.flatMap(episode => (episode.get('Files') as File[] | undefined) ?? []);
            for (const file of files) {
                const source = file.get('path') as string | undefined;
                if (!source) continue;
                const parts = groupBy.map(key => {
                    if (key === 'year') return String(item.get('releaseDate') ?? '').slice(0, 4);
                    if (key === 'genre') return String(item.get('genres') ?? '').split(',').map(genre => genre.trim()).filter(Boolean).join(', ');
                    return item.get(key) as string | undefined;
                }).filter((part): part is string => Boolean(part));
                if (type === 'series' && separateSeasons) {
                    const episode = episodes.find(candidate => ((candidate.get('Files') as File[] | undefined) ?? []).some(candidateFile => candidateFile.id === file.id));
                    if (episode) parts.push(`Season ${episode.get('airedSeason') as number}`);
                }
                const targetDir = join(root, ...parts);
                await mkdir(targetDir, { recursive: true });
                const target = join(targetDir, source.split(/[\\/]/).pop() as string);
                if (target !== source) await rename(source, target);
            }
        }
    };
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
    // "Scan all libraries" in a Jellyfin app's dashboard: the same scan as the maintenance page's.
    server.post('/library/refresh', async (req: EmbyRequest, res: Response) => {
        if (!await embyUserCan(req, 'libraries.manage')) return res.status(403).send('Forbidden');

        const work = maintenanceWork(embyEmulation.oblecto, 'scan', 'all');

        if (work) embyEmulation.oblecto.queue.maintenance.start('scan', 'all', work);
        res.status(204).send();
    });
    server.post('/library/cleanup', async (req: EmbyRequest, res: Response) => {
        if (!await embyUserCan(req, 'libraries.manage')) return res.status(403).send('Forbidden');
        const body = (req.body ?? {}) as { type?: 'movie' | 'series'; groupBy?: string[]; separateSeasons?: boolean };
        await cleanup(body.type ?? 'series', body.groupBy ?? [], body.separateSeasons ?? false);
        res.status(204).send();
    });
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
    // Every genre in the library, or in one library view
    server.get('/genres', async (req: EmbyRequest, res: Response) => {
        const parent = getRequestValue(req, 'ParentId');
        const types = getRequestList(req, 'IncludeItemTypes').map(type => type.toLowerCase());
        const kinds: Array<'movie' | 'series'> = parent === 'movies' || types.includes('movie') ? ['movie']
            : parent === 'shows' || types.includes('series') ? ['series'] : ['movie', 'series'];
        const searchTerm = (getRequestValue(req, 'SearchTerm') ?? getRequestValue(req, 'NameStartsWith') ?? '').toLowerCase();
        const startIndex = Math.max(0, Number(getRequestValue(req, 'StartIndex')) || 0);
        const limit = Math.min(Math.max(Number(getRequestValue(req, 'Limit')) || 1000, 1), 1000);
        const genres = (await allGenres(kinds)).filter(genre => genre.toLowerCase().includes(searchTerm));

        res.send({
            Items: genres.slice(startIndex, startIndex + limit).map(genre => formatGenre(genre, embyEmulation)),
            TotalRecordCount: genres.length,
            StartIndex: startIndex
        });
    });
    server.get('/genres/:genrename', async (req: EmbyRequest, res: Response) => {
        const wanted = String(req.params.genrename).toLowerCase();
        const genre = (await allGenres(['movie', 'series'])).find(name => name.toLowerCase() === wanted);

        if (!genre) return res.status(404).send('Not Found');
        res.send(formatGenre(genre, embyEmulation));
    });
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
