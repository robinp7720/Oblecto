/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions */
import { Person } from '../../../../models/person.js';
import { MovieCredit } from '../../../../models/movieCredit.js';
import { SeriesCredit } from '../../../../models/seriesCredit.js';
import { EpisodeCredit } from '../../../../models/episodeCredit.js';
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

    return {
        cast: serialized.filter(entry => entry.creditType === 'cast'),
        crew: serialized.filter(entry => entry.creditType === 'crew')
    };
}
