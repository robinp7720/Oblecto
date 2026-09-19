/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/strict-boolean-expressions */
import type { Transaction } from 'sequelize';
import { Person } from '../../../models/person.js';
import { MovieCredit } from '../../../models/movieCredit.js';
import { SeriesCredit } from '../../../models/seriesCredit.js';
import { EpisodeCredit } from '../../../models/episodeCredit.js';

export interface RetrievedCredit {
    tmdbid: number;
    name: string;
    profilePath?: string | null;
    knownForDepartment?: string | null;
    creditType: 'cast' | 'crew';
    character?: string | null;
    job?: string | null;
    department?: string | null;
    sortOrder?: number | null;
    episodeCount?: number | null;
}

type MediaType = 'movie' | 'series' | 'episode';

const creditModel = {
    movie: MovieCredit,
    series: SeriesCredit,
    episode: EpisodeCredit
};

const mediaKey = {
    movie: 'movieId',
    series: 'seriesId',
    episode: 'episodeId'
} as const;

/** Atomically replace one title's credits after a successful provider response. */
export async function syncCredits(mediaType: MediaType, mediaId: number, credits: RetrievedCredit[]): Promise<void> {
    // The three models intentionally share a runtime shape; Sequelize's static union cannot express it.
    const model = creditModel[mediaType] as any;
    const sequelize = model.sequelize;

    if (!sequelize) throw new Error('Credit models are not initialized');

    await sequelize.transaction(async (transaction: Transaction) => {
        await model.destroy({ where: { [mediaKey[mediaType]]: mediaId }, transaction } as never);

        for (const credit of credits) {
            if (!Number.isInteger(credit.tmdbid) || !credit.name) continue;

            const [person] = await Person.findOrCreate({
                where: { tmdbid: credit.tmdbid },
                defaults: {
                    tmdbid: credit.tmdbid,
                    name: credit.name,
                    biography: null,
                    birthday: null,
                    deathday: null,
                    placeOfBirth: null,
                    knownForDepartment: credit.knownForDepartment ?? null,
                    profilePath: credit.profilePath ?? null,
                    metadataUpdatedAt: null
                },
                transaction
            });

            const personUpdate: Record<string, unknown> = { name: credit.name };
            if (credit.profilePath) personUpdate.profilePath = credit.profilePath;
            if (credit.knownForDepartment) personUpdate.knownForDepartment = credit.knownForDepartment;
            await person.update(personUpdate, { transaction });

            await model.create({
                [mediaKey[mediaType]]: mediaId,
                personId: person.id,
                creditType: credit.creditType,
                character: credit.character ?? null,
                job: credit.job ?? null,
                department: credit.department ?? null,
                sortOrder: credit.sortOrder ?? null,
                ...(mediaType === 'series' ? { episodeCount: credit.episodeCount ?? null } : {})
            } as never, { transaction });
        }
    });
}
