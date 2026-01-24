import { Episode } from '../../../../../models/episode';
import { Series } from '../../../../../models/series';
import { TrackEpisode } from '../../../../../models/trackEpisode';
import { File } from '../../../../../models/file';
import { Stream } from '../../../../../models/stream';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-base-to-string, @typescript-eslint/no-unused-vars, @typescript-eslint/prefer-nullish-coalescing */
import { parseUuid, formatMediaItem, parseId, formatId } from '../../../helpers';
import { Op } from 'sequelize';

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

    server.get('/shows/:seriesid/seasons', async (req, res) => {
        const { id: seriesId } = parseId(req.params.seriesid);

        const series = await Series.findByPk(seriesId);

        if (!series) {
            return res.send({
                'Items': [],
                'TotalRecordCount': 0,
                'StartIndex': 0
            });
        }

        const episodes = await Episode.findAll({
            where: { SeriesId: seriesId },
            attributes: ['airedSeason'],
            order: [['airedSeason', 'ASC']]
        });

        const distinctSeasons = new Set<string>();

        episodes.forEach(ep => distinctSeasons.add(String(ep.airedSeason)));

        const items: any[] = [];
        const sortedSeasons = Array.from(distinctSeasons).sort((a: any, b: any) => a - b);

        for (const seasonNum of sortedSeasons) {
            const pseudoId = seriesId * 1000 + parseInt(seasonNum);
            const seasonObj = {
                id: pseudoId,
                seasonName: 'Season ' + seasonNum,
                seriesName: series.seriesName,
                SeriesId: seriesId,
                indexNumber: seasonNum
            };

            items.push(formatMediaItem(seasonObj, 'season', embyEmulation));
        }

        res.send({
            'Items': items,
            'TotalRecordCount': items.length,
            'StartIndex': 0
        });
    });

    server.get('/shows/:seriesid/episodes', async (req, res) => {
        const { id } = parseId(req.params.seriesid);
        const where: any = { SeriesId: id };

        if (req.query.season) {
            where.airedSeason = parseInt(String(req.query.season), 10);
        } else if (req.query.SeasonId || req.query.seasonid) {
            const parsed = parseId(String(req.query.SeasonId || req.query.seasonid));

            if (parsed.type === 'season') {
                const seasonNum = parsed.id % 1000;

                where.airedSeason = seasonNum;
            }
        }

        const userIdParam = String(req.query.userid || req.query.UserId || req.query.userId || '');
        const parsedUserId = userIdParam ? parseUuid(userIdParam) : null;

        const include: any[] = [Series, { model: File, include: [{ model: Stream }] }];

        if (parsedUserId) {
            include.push({
                model: TrackEpisode,
                required: false,
                where: { userId: parsedUserId }
            });
        }

        const episodes = await Episode.findAll({
            where,
            include,
            order: [['airedSeason', 'ASC'], ['airedEpisodeNumber', 'ASC']]
        });

        const items = episodes.map(ep => formatMediaItem(ep, 'episode', embyEmulation));

        res.send({
            'Items': items,
            'TotalRecordCount': items.length,
            'StartIndex': 0
        });
    });
};
