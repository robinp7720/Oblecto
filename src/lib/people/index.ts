import { promises as fs } from 'fs';
import Downloader from '../downloader/index.js';
import logger from '../../submodules/logger/index.js';
import type { Person } from '../../models/person.js';
import type Oblecto from '../oblecto/index.js';

// How long a person's biography and dates are trusted before TMDb is asked again.
const DETAIL_TTL = 30 * 24 * 60 * 60 * 1000;

/** Profile image sizes, as TMDb names them. */
export const PROFILE_SIZES = {
    small: 'w185',
    medium: 'w342',
    large: 'h632'
} as const;

export type ProfileSize = keyof typeof PROFILE_SIZES;

/** Fetch a person's biography and dates from TMDb, unless they were fetched recently. Never throws. */
export async function enrichPerson(oblecto: Oblecto, person: Person): Promise<void> {
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

/**
 * The local file of a person's profile image, downloaded from TMDb the first time it is asked for.
 * Null when the person has no profile image.
 */
export async function personProfileFile(oblecto: Oblecto, person: Person, size: ProfileSize = 'medium'): Promise<string | null> {
    if (!person.profilePath) return null;

    const path = oblecto.artworkUtils.personProfilePath(person, size);

    try {
        await fs.access(path);
    } catch {
        await fs.mkdir(oblecto.config.assets.personProfileLocation, { recursive: true });
        try {
            await Downloader.download(`https://image.tmdb.org/t/p/${PROFILE_SIZES[size]}${person.profilePath}`, path);
        } catch (error) {
            // A concurrent request may have filled the cache while this download was in flight.
            await fs.access(path).catch(() => { throw error; });
        }
    }

    return path;
}
