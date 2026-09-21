/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions */
import { Person } from '../../../../models/person.js';
import { MovieCredit } from '../../../../models/movieCredit.js';
import { SeriesCredit } from '../../../../models/seriesCredit.js';
import { EpisodeCredit } from '../../../../models/episodeCredit.js';
import { Episode } from '../../../../models/episode.js';
import { Op } from 'sequelize';
import type { Sequelize } from 'sequelize';

type MediaType = 'movie' | 'series' | 'episode';

const models = {
 movie: MovieCredit, series: SeriesCredit, episode: EpisodeCredit 
};
const keys = {
 movie: 'movieId', series: 'seriesId', episode: 'episodeId' 
} as const;

export async function creditsFor(mediaType: MediaType, id: number, sequelize?: Sequelize): Promise<{ cast: unknown[]; crew: unknown[] }> {
    const model = models[mediaType] as any;
    if (!model.sequelize || (sequelize && model.sequelize !== sequelize)) return { cast: [], crew: [] };
    const rows = await model.findAll({
        where: { [keys[mediaType]]: id },
        include: [{ model: Person, attributes: ['id', 'name', 'knownForDepartment'] }],
        order: [['creditType', 'ASC'], ['sortOrder', 'ASC'], ['id', 'ASC']]
    } as never);

    const grouped = new Map<string, any>();
    for (const row of rows) {
        const data = row.toJSON() as Record<string, unknown> & { Person?: Record<string, unknown> };
        const key = `${String(data.creditType)}-${String(data.Person?.id)}`;
        const entry = grouped.get(key) ?? {
            id: data.id,
            person: data.Person,
            creditType: data.creditType,
            order: data.sortOrder,
            roles: []
        };
        entry.order = Math.min(Number(entry.order ?? Number.MAX_SAFE_INTEGER), Number(data.sortOrder ?? Number.MAX_SAFE_INTEGER));
        entry.roles.push({
            character: data.character,
            job: data.job,
            department: data.department,
            episodeCount: data.episodeCount
        });
        grouped.set(key, entry);
    }

    const serialized = Array.from(grouped.values()).map(entry => ({
        ...entry,
        character: [...new Set(entry.roles.map((role: any) => role.character).filter(Boolean))].join(' / ') || null,
        job: [...new Set(entry.roles.map((role: any) => role.job).filter(Boolean))].join(' / ') || null,
        department: [...new Set(entry.roles.map((role: any) => role.department).filter(Boolean))].join(' / ') || null,
        episodeCount: Math.max(0, ...entry.roles.map((role: any) => Number(role.episodeCount) || 0)) || null
    })).sort((a, b) => a.order - b.order);

    const personIds = [...new Set(serialized.map(entry => Number(entry.person?.id)).filter(Number.isSafeInteger))];
    const connections = new Map<number, { movies: Set<number>; series: Set<number> }>();
    for (const personId of personIds) connections.set(personId, { movies: new Set(), series: new Set() });

    if (personIds.length) {
        const sameDatabase = (candidate: typeof MovieCredit | typeof SeriesCredit | typeof EpisodeCredit | typeof Episode): boolean =>
            Boolean(candidate.sequelize && (!sequelize || candidate.sequelize === sequelize));
        const [movieRows, seriesRows, episodeRows] = await Promise.all([
            sameDatabase(MovieCredit) ? MovieCredit.findAll({
                attributes: ['personId', 'movieId'], where: { personId: { [Op.in]: personIds } }, raw: true
            }) : [],
            sameDatabase(SeriesCredit) ? SeriesCredit.findAll({
                attributes: ['personId', 'seriesId'], where: { personId: { [Op.in]: personIds } }, raw: true
            }) : [],
            sameDatabase(EpisodeCredit) ? EpisodeCredit.findAll({
                attributes: ['personId', 'episodeId'], where: { personId: { [Op.in]: personIds } }, raw: true
            }) : []
        ]);
        const episodeIds = [...new Set(episodeRows.map(row => Number(row.episodeId)).filter(Number.isSafeInteger))];
        const episodeSeries = new Map<number, number>();
        if (episodeIds.length && sameDatabase(Episode)) {
            const episodes = await Episode.findAll({
                attributes: ['id', 'SeriesId'], where: { id: { [Op.in]: episodeIds } }, raw: true
            });
            for (const episode of episodes) episodeSeries.set(Number(episode.id), Number(episode.SeriesId));
        }
        const currentEpisode = mediaType === 'episode' && sameDatabase(Episode) ? await Episode.findByPk(id, { attributes: ['SeriesId'], raw: true }) : null;
        const excludedSeriesId = mediaType === 'series' ? id : Number(currentEpisode?.SeriesId) || null;

        for (const row of movieRows) if (!(mediaType === 'movie' && Number(row.movieId) === id)) connections.get(Number(row.personId))?.movies.add(Number(row.movieId));
        for (const row of seriesRows) if (Number(row.seriesId) !== excludedSeriesId) connections.get(Number(row.personId))?.series.add(Number(row.seriesId));
        for (const row of episodeRows) {
            const seriesId = episodeSeries.get(Number(row.episodeId));
            if (seriesId && seriesId !== excludedSeriesId) connections.get(Number(row.personId))?.series.add(seriesId);
        }
    }

    const withConnections = serialized.map(entry => {
        const connection = connections.get(Number(entry.person?.id));
        return {
            ...entry,
            libraryConnections: { movies: connection?.movies.size ?? 0, series: connection?.series.size ?? 0 }
        };
    });
    return {
        cast: withConnections.filter(entry => entry.creditType === 'cast'),
        crew: withConnections.filter(entry => entry.creditType === 'crew')
    };
}
