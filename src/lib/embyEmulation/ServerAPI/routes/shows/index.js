import { Episode } from '../../../../../models/episode';
import { Series } from '../../../../../models/series';
import { TrackEpisode } from '../../../../../models/trackEpisode';
import { File } from '../../../../../models/file';
import { parseUuid, formatMediaItem, parseId, formatId } from '../../../helpers';
import { Op } from 'sequelize';

/**
 * @param {*} server
 * @param {EmbyEmulation} embyEmulation
 */
export default (server, embyEmulation) => {
    server.get('/shows/nextup', async (req, res) => {
        const userIdParam = req.query.UserId || req.query.userId || req.query.userid;
        const userId = userIdParam ? parseUuid(userIdParam) : null;

        if (!userId) {
            return res.send({
                'Items': [], 'TotalRecordCount': 0, 'StartIndex': 0
            });
        }

        // 1. Get all tracked episodes for this user
        const tracked = await TrackEpisode.findAll({
            where: { userId },
            include: [
                {
                    model: Episode,
                    include: [Series, File]
                }
            ],
            order: [['updatedAt', 'DESC']]
        });

        // 2. For each series, find the "next" episode
        const seriesMap = new Map();
        const nextEpisodes = [];

        for (const track of tracked) {
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
                    },
                    include: [Series, File],
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

        const episodes = await Episode.findAll({
            where: { SeriesId: seriesId },
            attributes: ['airedSeason'],
            order: [['airedSeason', 'ASC']]
        });

        const distinctSeasons = new Set();

        episodes.forEach(ep => distinctSeasons.add(ep.airedSeason));

        const items = [];
        const sortedSeasons = Array.from(distinctSeasons).sort((a, b) => a - b);

        for (const seasonNum of sortedSeasons) {
            const pseudoId = seriesId * 1000 + seasonNum;
            const seasonObj = {
                id: pseudoId,
                seasonName: 'Season ' + seasonNum,
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
        const where = { SeriesId: id };

        if (req.query.season) {
            where.airedSeason = parseInt(req.query.season);
        } else if (req.query.SeasonId || req.query.seasonid) {
            const parsed = parseId(req.query.SeasonId || req.query.seasonid);

            if (parsed.type === 'season') {
                const seasonNum = parsed.id % 1000;

                where.airedSeason = seasonNum;
            }
        }

        const episodes = await Episode.findAll({
            where,
            include: [
                Series, File, {
                    model: TrackEpisode,
                    required: false,
                    where: { userId: parseUuid(req.query.userid || req.query.UserId || req.query.userId) }
                }
            ],
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
