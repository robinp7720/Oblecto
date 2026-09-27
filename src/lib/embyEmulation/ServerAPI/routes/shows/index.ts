import { Episode } from '../../../../../models/episode';
import { Series } from '../../../../../models/series';
import { TrackEpisode } from '../../../../../models/trackEpisode';
import { File } from '../../../../../models/file';
import { Stream } from '../../../../../models/stream';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-base-to-string, @typescript-eslint/prefer-nullish-coalescing */
import { parseUuid, formatMediaItem, parseId, formatId } from '../../../helpers';
import { Op } from 'sequelize';
import { queryItems } from '../../itemQuery.js';
import { getRequestValue } from '../../requestUtils.js';
import type { EmbyRequest } from '../../index.js';

/**
 * @param server
 * @param embyEmulation
 */
import type { Application, Request, Response } from 'express';
import type EmbyEmulation from '../../../index.js';

export default (server: Application, embyEmulation: EmbyEmulation): void => {
    server.get('/shows/nextup', async (req: Request, res: Response) => {
        const userIdParam = String(req.query.UserId || req.query.userId || req.query.userid || '');
        const userId = userIdParam ? parseUuid(userIdParam) : null;

        if (!userId) {
            return res.send({
                'Items': [], 'TotalRecordCount': 0, 'StartIndex': 0
            });
        }

        const seriesIdParam = String(req.query.SeriesId || req.query.seriesId || req.query.seriesid || '');
        const seriesIdParsed = seriesIdParam ? parseId(seriesIdParam) : null;
        const seriesIdFilter = seriesIdParsed?.type === 'series' ? seriesIdParsed.id : null;

        const episodeInclude: any = {
            model: Episode,
            include: [Series, { model: File, include: [{ model: Stream }] }]
        };

        if (seriesIdFilter) {
            episodeInclude.where = { SeriesId: seriesIdFilter };
        }

        // 1. Get all tracked episodes for this user
        const tracked = await TrackEpisode.findAll({
            where: { userId },
            include: [episodeInclude],
            order: [['updatedAt', 'DESC']]
        });

        // 2. For each series, find the "next" episode
        const seriesMap = new Map<number, boolean>();
        const nextEpisodes: Episode[] = [];

        for (const track of tracked as any[]) {
            const seriesId = track.Episode.SeriesId;

            if (seriesMap.has(seriesId)) continue;
            seriesMap.set(seriesId, true);

            if (track.progress < 1) {
                // Resume this episode
                nextEpisodes.push(track.Episode);
            } else {
                // Find next episode in series
                const next = await Episode.findOne({
                    where: {
                        SeriesId: seriesId,
                        [Op.or]: [
                            {
                                airedSeason: track.Episode.airedSeason,
                                airedEpisodeNumber: { [Op.gt]: track.Episode.airedEpisodeNumber }
                            },
                            { airedSeason: { [Op.gt]: track.Episode.airedSeason } }
                        ]
                    } as any,
                    include: [Series, { model: File, include: [{ model: Stream }] }],
                    order: [['airedSeason', 'ASC'], ['airedEpisodeNumber', 'ASC']]
                });

                if (next) {
                    nextEpisodes.push(next);
                }
            }
        }

        const items = nextEpisodes.map(ep => formatMediaItem(ep, 'episode', embyEmulation));

        res.send({
            'Items': items,
            'TotalRecordCount': items.length,
            'StartIndex': 0
        });
    });

    server.get('/shows/:seriesid/seasons', async (req: EmbyRequest, res: Response) => {
        const series = parseId(req.params.seriesid);

        req.query = {
 ...req.query, ParentId: formatId(series.id, 'series'), IncludeItemTypes: 'Season' 
};
        res.send(await queryItems(req, embyEmulation));
    });

    // Episodes of a series, optionally of one season (by number or by season id)
    server.get('/shows/:seriesid/episodes', async (req: EmbyRequest, res: Response) => {
        const series = parseId(req.params.seriesid);
        const seasonNumber = getRequestValue(req, 'Season');
        const seasonId = getRequestValue(req, 'SeasonId');
        let parent = formatId(series.id, 'series');

        if (seasonId && parseId(seasonId).type === 'season') parent = seasonId;
        else if (seasonNumber !== undefined && Number.isFinite(parseInt(seasonNumber, 10))) parent = formatId(series.id * 1000 + parseInt(seasonNumber, 10), 'season');

        req.query = {
            ...req.query, ParentId: parent, IncludeItemTypes: 'Episode', SeriesId: undefined, Season: undefined, SeasonId: undefined
        };
        res.send(await queryItems(req, embyEmulation));
    });
};
