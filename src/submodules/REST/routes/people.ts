/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing */
import { promises as fs } from 'fs';
import { Express, Response } from 'express';
import authMiddleWare from '../middleware/auth.js';
import type Oblecto from '../../../lib/oblecto/index.js';
import type { OblectoRequest } from '../index.js';
import { Person } from '../../../models/person.js';
import { MovieCredit } from '../../../models/movieCredit.js';
import { SeriesCredit } from '../../../models/seriesCredit.js';
import { EpisodeCredit } from '../../../models/episodeCredit.js';
import { Movie } from '../../../models/movie.js';
import { Series } from '../../../models/series.js';
import { Episode } from '../../../models/episode.js';
import { TrackMovie } from '../../../models/trackMovie.js';
import { TrackEpisode } from '../../../models/trackEpisode.js';
import Downloader from '../../../lib/downloader/index.js';
import logger from '../../logger/index.js';
import { containsText } from '../../../lib/common/textSearch.js';

const DETAIL_TTL = 30 * 24 * 60 * 60 * 1000;
const imageSize = {
    small: 'w185',
    medium: 'w342',
    large: 'h632'
} as const;

async function enrichPerson(oblecto: Oblecto, person: Person): Promise<void> {
    if (person.metadataUpdatedAt && Date.now() - person.metadataUpdatedAt.getTime() < DETAIL_TTL) return;

    try {
        const data = await oblecto.tmdb.personInfo({ id: person.tmdbid });
        await person.update({
            name: data.name || person.name,
            biography: data.biography || null,
            birthday: data.birthday || null,
            deathday: data.deathday || null,
            placeOfBirth: data.place_of_birth || null,
            knownForDepartment: data.known_for_department || person.knownForDepartment,
            profilePath: data.profile_path || person.profilePath,
            metadataUpdatedAt: new Date()
        });
    } catch (error) {
        logger.warn(`Could not refresh metadata for person ${person.id}`, error);
    }
}

function groupCredits(rows: Array<Record<string, any>>, mediaKey: string): unknown[] {
    const grouped = new Map<number, { item: unknown; roles: Array<Record<string, unknown>> }>();

    for (const row of rows) {
        const item = row[mediaKey];
        if (!item) continue;
        const existing: { item: unknown; roles: Array<Record<string, unknown>> } = grouped.get(item.id) ?? { item, roles: [] };
        existing.roles.push({
            type: row.creditType,
            character: row.character,
            job: row.job,
            department: row.department,
            episodeCount: row.episodeCount
        });
        grouped.set(item.id, existing);
    }

    return Array.from(grouped.values());
}

export default (server: Express, oblecto: Oblecto): void => {
    server.get('/people/search/:name', authMiddleWare.requiresAuth, async (req: OblectoRequest, res: Response) => {
        const count = Math.min(50, Math.max(1, Number(req.combined_params?.count) || 20));
        const people = await Person.findAll({
            where: containsText('name', String(req.params.name)),
            order: [['name', 'ASC']],
            limit: count
        });
        res.send(people);
    });

    server.get('/person/:id/info', authMiddleWare.requiresAuth, async (req: OblectoRequest, res: Response) => {
        const person = await Person.findByPk(req.params.id as string);
        if (!person) return res.status(404).send({ message: 'Person not found' });

        await enrichPerson(oblecto, person);
        const userId = req.authorization!.user.id;
        const [movieRows, seriesRows, episodeRows] = await Promise.all([
            MovieCredit.findAll({
                include: [
                    {
                        model: Movie,
                        include: [
                            {
                                model: TrackMovie,
                                required: false,
                                where: { userId }
                            }
                        ]
                    }
                ],
                where: { personId: person.id }
            }),
            SeriesCredit.findAll({ include: [Series], where: { personId: person.id } }),
            EpisodeCredit.findAll({
                include: [
                    {
                        model: Episode,
                        include: [
                            Series,
                            {
                                model: TrackEpisode,
                                required: false,
                                where: { userId }
                            }
                        ]
                    }
                ],
                where: { personId: person.id }
            })
        ]);

        res.send({
            ...person.toJSON(),
            credits: {
                movies: groupCredits(movieRows.map(row => row.toJSON() as Record<string, any>), 'Movie'),
                series: groupCredits(seriesRows.map(row => row.toJSON() as Record<string, any>), 'Series'),
                episodes: groupCredits(episodeRows.map(row => row.toJSON() as Record<string, any>), 'Episode')
            }
        });
    });

    server.get('/person/:id/profile', async (req: OblectoRequest, res: Response) => {
        const person = await Person.findByPk(req.params.id as string);
        if (!person?.profilePath) return res.status(404).send({ message: 'Profile image not found' });

        const requested = String(req.combined_params?.size || 'medium');
        const size = requested in imageSize ? requested as keyof typeof imageSize : 'medium';
        const path = oblecto.artworkUtils.personProfilePath(person, size);

        try {
            await fs.access(path);
        } catch {
            await fs.mkdir(oblecto.config.assets.personProfileLocation, { recursive: true });
            try {
                await Downloader.download(`https://image.tmdb.org/t/p/${imageSize[size]}${person.profilePath}`, path);
            } catch (error) {
                // A concurrent request may have filled the cache while this download was in flight.
                await fs.access(path).catch(() => { throw error; });
            }
        }

        res.sendFile(path);
    });
};
