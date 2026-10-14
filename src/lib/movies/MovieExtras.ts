import type { MovieDb } from 'moviedb-promise';
import { Movie, type MovieTrailer, type MovieCertification } from '../../models/movie.js';
import { optionalMetadata } from '../updaters/common/optionalMetadata.js';

const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
type Provider = Pick<MovieDb, 'movieVideos' | 'movieReleaseDates'>;
export type MovieExtrasResult = { trailers: MovieTrailer[]; certifications: MovieCertification[]; unavailable: boolean };

function record(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function results(value: unknown): unknown[] {
    const entries = record(value).results;
    if (!Array.isArray(entries) || entries.some(entry => typeof entry !== 'object' || entry === null || Array.isArray(entry))) {
        throw new Error('Malformed movie extras response');
    }
    return entries as unknown[];
}

export function movieTrailers(value: unknown): MovieTrailer[] {
    const found = new Map<string, MovieTrailer>();
    for (const entry of results(value)) {
        const video = record(entry);
        if (typeof video.type !== 'string' || typeof video.key !== 'string' || typeof video.site !== 'string') throw new Error('Malformed movie video');
        if (video.type !== 'Trailer') continue;
        if (!(video.site === 'YouTube' && /^[\w-]{11}$/.test(video.key))
            && !(video.site === 'Vimeo' && /^\d{1,12}$/.test(video.key))) continue;
        found.set(`${String(video.site)}:${video.key}`, {
            name: typeof video.name === 'string' && video.name.trim() ? video.name.trim() : 'Trailer',
            site: video.site,
            key: video.key,
            language: typeof video.iso_639_1 === 'string' ? video.iso_639_1 : null,
            official: video.official === true
        });
    }
    return [...found.values()].sort((a, b) => Number(b.official) - Number(a.official) || a.name.localeCompare(b.name));
}

export function movieCertifications(value: unknown): MovieCertification[] {
    const found = new Map<string, MovieCertification>();
    for (const entry of results(value)) {
        const region = record(entry);
        if (typeof region.iso_3166_1 !== 'string' || !/^[A-Z]{2}$/.test(region.iso_3166_1)) throw new Error('Malformed certification region');
        if (!Array.isArray(region.release_dates)) throw new Error('Malformed movie certifications');
        // Prefer the theatrical classification, then limited theatrical, then other releases.
        const releases = (region.release_dates as unknown[]).map(record)
            .filter(release => {
                if (typeof release.certification !== 'string') throw new Error('Malformed movie certification');
                return release.certification.trim().length > 0;
            })
            .sort((a, b) => {
                const rank = (type: unknown): number => type === 3 ? 0 : type === 2 ? 1 : 2;
                const date = (release: Record<string, unknown>): string => typeof release.release_date === 'string' ? release.release_date : '';
                return rank(a.type) - rank(b.type) || date(a).localeCompare(date(b));
            });
        if (releases.length) found.set(region.iso_3166_1, {
            country: region.iso_3166_1,
            certification: String(releases[0].certification).trim()
        });
    }
    return [...found.values()].sort((a, b) => a.country.localeCompare(b.country));
}

/** Optional metadata loads independently of the movie page and is shared across viewers. */
export class MovieExtras {
    private pending = new Map<number, Promise<MovieExtrasResult>>();

    constructor(private provider: Provider) {}

    get(movie: Movie): Promise<MovieExtrasResult> {
        const existing = this.pending.get(movie.id);
        if (existing) return existing;
        const request = this.refresh(movie).finally(() => { this.pending.delete(movie.id); });
        this.pending.set(movie.id, request);
        return request;
    }

    private async refresh(movie: Movie): Promise<MovieExtrasResult> {
        let unavailable = false;
        const fresh = (date: Date | null): boolean => date !== null && Date.now() - new Date(date).getTime() < CACHE_MS;
        if (movie.tmdbid !== null && movie.tmdbid > 0) {
            const id = movie.tmdbid;
            const [trailers, certifications] = await Promise.all([
                fresh(movie.trailersUpdatedAt) ? undefined : optionalMetadata(async () => movieTrailers(
                    await this.provider.movieVideos({ id }, { timeout: 5000 })
                ), `TMDB movie ${movie.id} trailers`),
                fresh(movie.certificationsUpdatedAt) ? undefined : optionalMetadata(async () => movieCertifications(
                    await this.provider.movieReleaseDates({ id }, { timeout: 5000 })
                ), `TMDB movie ${movie.id} certifications`)
            ]);
            unavailable = (!fresh(movie.trailersUpdatedAt) && trailers === undefined)
                || (!fresh(movie.certificationsUpdatedAt) && certifications === undefined);
            // Failed or malformed responses leave the last good cache and its timestamp intact.
            if (trailers !== undefined || certifications !== undefined) await movie.update({
                ...(trailers !== undefined ? { trailers, trailersUpdatedAt: new Date() } : {}),
                ...(certifications !== undefined ? { certifications, certificationsUpdatedAt: new Date() } : {})
            }, { silent: true });
        }
        return {
            trailers: movie.trailers ?? [],
            certifications: movie.certifications ?? [],
            unavailable
        };
    }
}
