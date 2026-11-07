import { Person } from '../../models/person.js';
import { MovieCredit } from '../../models/movieCredit.js';
import { SeriesCredit } from '../../models/seriesCredit.js';
import { EpisodeCredit } from '../../models/episodeCredit.js';
import { Episode } from '../../models/episode.js';
import { Op } from 'sequelize';
import type { Model, ModelStatic, Sequelize } from 'sequelize';

type MediaType = 'movie' | 'series' | 'episode';
export type CreditPerson = { id: number; name: string | null; knownForDepartment: string | null };
export type CreditRole = { character: string | null; job: string | null; department: string | null; episodeCount?: number | null };
export interface LibraryCredit extends CreditRole {
    id: number;
    person?: CreditPerson | null;
    creditType: 'cast' | 'crew';
    order: number;
    roles: CreditRole[];
    libraryConnections: { movies: number; series: number };
}
interface CreditRow extends CreditRole {
    id: number;
    Person?: CreditPerson | null;
    creditType: 'cast' | 'crew';
    sortOrder: number | null;
}
type GroupedCredit = Omit<LibraryCredit, keyof CreditRole | 'libraryConnections'>;
const joinedRoles = (roles: CreditRole[], field: 'character' | 'job' | 'department'): string | null =>
    [...new Set(roles.map(role => role[field]).filter((value): value is string => typeof value === 'string' && value.length > 0))].join(' / ') || null;

const models = {
    movie: MovieCredit, series: SeriesCredit, episode: EpisodeCredit
};
const keys = {
    movie: 'movieId', series: 'seriesId', episode: 'episodeId'
} as const;

export async function creditsFor(mediaType: MediaType, id: number, sequelize?: Sequelize): Promise<{ cast: LibraryCredit[]; crew: LibraryCredit[] }> {
    const model: ModelStatic<Model> = models[mediaType];
    if (!model.sequelize || (sequelize && model.sequelize !== sequelize)) return { cast: [], crew: [] };
    const rows = await model.findAll({
        where: { [keys[mediaType]]: id },
        include: [{ model: Person, attributes: ['id', 'name', 'knownForDepartment'] }],
        order: [['creditType', 'ASC'], ['sortOrder', 'ASC'], ['id', 'ASC']]
    });

    const grouped = new Map<string, GroupedCredit>();
    for (const row of rows) {
        const data = row.toJSON<CreditRow>();
        const key = `${String(data.creditType)}-${String(data.Person?.id)}`;
        const entry = grouped.get(key) ?? {
            id: data.id,
            person: data.Person,
            creditType: data.creditType,
            order: data.sortOrder ?? Number.MAX_SAFE_INTEGER,
            roles: []
        };
        entry.order = Math.min(entry.order, data.sortOrder ?? Number.MAX_SAFE_INTEGER);
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
        character: joinedRoles(entry.roles, 'character'),
        job: joinedRoles(entry.roles, 'job'),
        department: joinedRoles(entry.roles, 'department'),
        episodeCount: Math.max(0, ...entry.roles.map(role => role.episodeCount ?? 0)) || null
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
            if (seriesId !== undefined && seriesId !== 0 && seriesId !== excludedSeriesId) connections.get(Number(row.personId))?.series.add(seriesId);
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
