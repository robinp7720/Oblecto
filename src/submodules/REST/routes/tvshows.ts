import { normalizeGenres } from '../../../lib/library/facets.js';
import { matchSeriesEpisodes } from '../../../lib/series/episodeMatching.js';
import { relatedTitles } from '../../../lib/library/related.js';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unused-vars, @typescript-eslint/prefer-nullish-coalescing */
import { Express, Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';

import authMiddleWare from '../middleware/auth.js';
import errors from '../errors.js';

import { Series } from '../../../models/series.js';
import { Episode } from '../../../models/episode.js';
import { TrackEpisode } from '../../../models/trackEpisode.js';
import { SeriesSet } from '../../../models/seriesSet.js';
import { visibleSeriesSets } from '../../../lib/sets/visibility.js';
import { File } from '../../../models/file.js';
import Oblecto from '../../../lib/oblecto/index.js';
import { OblectoRequest } from '../index.js';
import { parseBrowseParams } from './helpers/browse.js';
import { browseResponse } from './helpers/browseResponse.js';
import { InvalidBrowseQueryError } from '../../../lib/library/types.js';
import { saveArtwork } from '../../../lib/artwork/ArtworkUpload.js';
import { firstUpload } from '../../../lib/users/avatars.js';
import upload from '../middleware/upload.js';
import { containsText } from '../../../lib/common/textSearch.js';
import { creditsFor } from '../../../lib/library/credits.js';
import { favouritesAmong, setFavourite } from '../../../lib/users/favourites.js';
import { isWatchlisted, setWatchlisted } from '../../../lib/users/seriesWatchlist.js';
import { earlierEpisodes } from './helpers/episodeContext.js';
import { setPlayed } from '../../../lib/playback/progress.js';

const LEGACY_ALLOWED_ORDERS = ['desc', 'asc'];
export default (server: Express, oblecto: Oblecto) => {
    server.get('/series/list/:sorting', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const params = req.combined_params || {};

        let browseParams;
        try {
            browseParams = parseBrowseParams(params);
        } catch (error: any) {
            return res.status(400).send({ message: error.message || 'Invalid browse query' });
        }

        if (browseParams.mode !== 'browse') {
            const limit = parseInt((params.count as string) || '20', 10) || 20;
            const page = parseInt((params.page as string) || '0', 10) || 0;
            const legacyOrder = (params.order as string)?.toLowerCase() || 'asc';

            if (LEGACY_ALLOWED_ORDERS.indexOf(legacyOrder) === -1)
                return res.status(400).send({ message: 'Sorting order is invalid' });

            if (!(String(req.params.sorting) in Series.rawAttributes))
                return res.status(400).send({ message: 'Sorting method is invalid' });

            const results = await Series.findAll({
                order: [[String(req.params.sorting), legacyOrder]],
                limit,
                offset: limit * page
            });

            return res.send(results);
        }

        try {
            return res.send(await browseResponse('series', String(req.params.sorting), browseParams, Number(req.authorization!.user.id)));
        } catch (error) {
            if (error instanceof InvalidBrowseQueryError) return res.status(400).send({ message: error.message });
            throw error;
        }
    });

    server.get('/series/sets', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const results = await SeriesSet.findAll({ where: visibleSeriesSets(req.authorization!.user.id) });

        res.send(results);
    });

    server.get('/series/set/:id', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const params = req.combined_params!;
        const limit = parseInt(params.count as string) || 20;
        const page = parseInt(params.page as string) || 0;

        const results = await SeriesSet.findAll({
            include: [{ model: Series }],
            where: { [Op.and]: [{ id: req.params.id }, visibleSeriesSets(req.authorization!.user.id)] },
            limit,
            offset: limit * page
        });

        res.send(results);
    });

    server.get('/series/:id/sets', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const series: any = await Series.findByPk(req.params.id as string, {
            attributes: [],
            include: [
                {
                    model: SeriesSet,
                    required: false,
                    where: visibleSeriesSets(req.authorization!.user.id),
                    include: [{ model: Series }]
                }
            ]
        });

        res.send(series ? series.SeriesSets : []);
    });

    server.put('/series/:id/sets', authMiddleWare.requiresPermission('libraries.manage'), async function (req: Request, res: Response) {
        try {
            const series = await Series.findByPk(req.params.id as string);
            const set = await SeriesSet.findByPk(req.body.setId);

            if (!series || !set) return res.status(404).send({ message: 'Series or set not found' });
            await set.addSeries(series);
            res.send({ success: true });
        } catch (e) {
            return res.status(500).send({ message: 'Error adding series to set' });
        }
    });

    server.get('/series/:id/related', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const item = await Series.findByPk(req.params.id as string);
        if (!item) return res.status(404).send({ message: 'Series not found' });
        const items = await relatedTitles(Series.sequelize!, 'series', item.id, item.genre);
        res.send({ items });
    });

    server.get('/series/:id/info', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const show = await Series.findByPk(req.params.id as string);

        if (!show) return res.status(404).send({ message: 'Series not found' });

        const data: any = show.toJSON();

        if (data.genre) data.genre = normalizeGenres(data.genre);
        data.credits = await creditsFor('series', show.id, Series.sequelize);
        const userId = Number(req.authorization!.user.id);
        const [favourites, watchlist] = await Promise.all([favouritesAmong(userId, [{ type: 'series', id: show.id }]), isWatchlisted(userId, show.id)]);
        data.userState = { favourite: favourites.has(`series:${show.id}`), watchlist };
        delete data.episodeCatalog;

        res.send(data);
    });

    server.get('/series/:id/library', authMiddleWare.requiresPermission('libraries.manage'), async function (req: OblectoRequest, res: Response) {
        const show = await Series.unscoped().findByPk(req.params.id as string);
        if (!show) return res.status(404).send({ message: 'Series not found' });
        const [snapshot, episodes] = await Promise.all([
            oblecto.seriesExtras.getCatalog(show),
            Episode.findAll({
                where: { SeriesId: show.id },
                attributes: ['id', 'tmdbid', 'tvdbid', 'airedSeason', 'airedEpisodeNumber', 'episodeName'],
                include: [
                    {
                        model: File,
                        attributes: ['id'],
                        through: { attributes: [] }
                    }
                ]
            })
        ]);
        res.send({
            series: {
                id: show.id,
                seriesName: show.seriesName,
                tmdbid: show.tmdbid
            },
            catalogUpdatedAt: snapshot.catalogUpdatedAt,
            catalogAvailable: snapshot.catalog !== null,
            unavailable: snapshot.unavailable,
            rows: matchSeriesEpisodes(episodes.map(episode => episode.toJSON()), snapshot.catalog)
        });
    });

    server.get('/series/:id/extras', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const show = await Series.unscoped().findByPk(req.params.id as string);
        if (!show) return res.status(404).send({ message: 'Series not found' });
        res.send(await oblecto.seriesExtras.get(show));
    });

    server.put('/series/:id/favourite', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        if (typeof req.body?.favourite !== 'boolean') return res.status(400).send({ message: 'favourite must be a boolean' });
        const show = await Series.findByPk(req.params.id as string, { attributes: ['id'] });
        if (!show) return res.status(404).send({ message: 'Series not found' });
        await setFavourite(Number(req.authorization!.user.id), 'series', show.id, req.body.favourite);
        res.send({ favourite: req.body.favourite });
    });

    server.put('/series/:id/watchlist', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        if (typeof req.body?.watchlist !== 'boolean') return res.status(400).send({ message: 'watchlist must be a boolean' });
        const show = await Series.findByPk(req.params.id as string, { attributes: ['id'] });
        if (!show) return res.status(404).send({ message: 'Series not found' });
        await setWatchlisted(Number(req.authorization!.user.id), show.id, req.body.watchlist);
        res.send({ watchlist: req.body.watchlist });
    });

    server.put('/series/:id/episodes/:episodeId/earlier/watched', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        if (req.body?.watched !== true) return res.status(400).send({ message: 'watched must be true' });
        const rows = await Episode.findAll({ where: { SeriesId: req.params.id } });
        const anchor = rows.find(row => row.id === Number(req.params.episodeId));
        if (!anchor) return res.status(404).send({ message: 'Episode not found in this series' });
        const episodes = earlierEpisodes(rows.map(row => row.toJSON()), anchor.id);
        const userId = Number(req.authorization!.user.id);
        await Promise.all(episodes.map(episode => setPlayed(userId, 'episode', Number(episode.id), true)));
        const tracks = await TrackEpisode.findAll({ where: { userId, episodeId: { [Op.in]: episodes.map(episode => Number(episode.id)) } } });
        const byEpisode = new Map(tracks.map(track => [Number(track.episodeId), track.toJSON()]));
        res.send({ watched: true, episodes: episodes.map(episode => ({ id: episode.id, track: byEpisode.get(Number(episode.id)) })) });
    });

    // Endpoint to get all episodes within a series
    server.get('/series/:id/episodes', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const show = await Episode.findAll({
            include: [
                { model: Series, attributes: ['id', 'seriesName'] },
                {
                    model: File,
                    attributes: ['id', 'duration'],
                    through: { attributes: [] }
                },
                {
                    model: TrackEpisode,
                    required: false,
                    where: { userId: req.authorization!.user.id }
                }
            ],
            where: { SeriesId: req.params.id },
            order: [
                ['airedSeason', 'ASC'],
                ['airedEpisodeNumber', 'ASC']
            ]
        });

        res.send(show);
    });

    server.put('/series/:id/seasons/:season/watched', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        if (typeof req.body?.watched !== 'boolean') return res.status(400).send({ message: 'watched must be a boolean' });
        const watched: boolean = req.body.watched;
        const series = await Series.findByPk(req.params.id as string, { attributes: ['id'] });
        if (!series) return res.status(404).send({ message: 'Series not found' });
        const episodes = await Episode.findAll({
            attributes: ['id'],
            where: { SeriesId: series.id, airedSeason: String(req.params.season) }
        });
        if (!episodes.length) return res.status(404).send({ message: 'Season not found' });
        const userId = Number(req.authorization!.user.id);
        await Promise.all(episodes.map(episode => setPlayed(userId, 'episode', episode.id, watched)));
        const tracks = await TrackEpisode.findAll({ where: { userId, episodeId: { [Op.in]: episodes.map(episode => episode.id) } } });
        const byEpisode = new Map(tracks.map(track => [Number(track.episodeId), track.toJSON()]));
        res.send({
            watched,
            episodes: episodes.map(episode => ({ id: episode.id, track: byEpisode.get(episode.id) }))
        });
    });

    // Public on purpose: the web UI and Jellyfin apps load artwork with plain <img> requests, which
    // cannot carry a token. Artwork reveals titles in the library, nothing about users. See SECURITY.md.
    server.get('/series/:id/fanart', async function (req: OblectoRequest, res: Response) {
        const show = await Series.findByPk(req.params.id as string);
        if (!show) return res.status(404).send({ message: 'Series not found' });
        res.sendFile(oblecto.artworkUtils.seriesFanartPath(show, (req.combined_params?.size as string) || 'large'));
    });

    server.get('/series/:id/poster', async function (req: OblectoRequest, res: Response) {
        const show = await Series.findByPk(req.params.id as string);

        if (!show) return res.status(404).send({ message: 'Series not found' });

        const imagePath = oblecto.artworkUtils.seriesPosterPath(show, (req.combined_params?.size as string) || 'medium');

        res.sendFile(imagePath);
    });

    server.put('/series/:id/poster', authMiddleWare.requiresPermission('libraries.manage'), upload, async function (req: OblectoRequest, res: Response) {
        const show = await Series.findByPk(req.params.id as string);

        if (!show) {
            return res.status(404).send({ message: 'Series does not exist' });
        }

        await saveArtwork(oblecto, firstUpload(req.files), 'poster', size => oblecto.artworkUtils.seriesPosterPath(show, size));

        res.send(['success']);
    });

    server.get('/shows/search/:name', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        const series = await Series.findAll({ where: containsText('seriesName', String(req.params.name)) });

        res.send(series);
    });
};
