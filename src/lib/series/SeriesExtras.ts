import type { MovieDb } from 'moviedb-promise';
import { Series, type CatalogEpisode, type EpisodeCatalog } from '../../models/series.js';
import type { MovieCertification, MovieTrailer } from '../../models/movie.js';
import { movieTrailers } from '../movies/MovieExtras.js';
import { optionalMetadata } from '../updaters/common/optionalMetadata.js';

type Provider = Pick<MovieDb, 'tvVideos' | 'tvContentRatings' | 'tvInfo' | 'seasonInfo'>;
export type SeriesExtrasResult = {
    trailers: MovieTrailer[]; certifications: MovieCertification[];
    unavailable: boolean;
};
export type SeriesCatalogResult = { catalog: EpisodeCatalog | null; catalogUpdatedAt: Date | null; unavailable: boolean };
const DAY = 24 * 60 * 60 * 1000;
const record = (value: unknown): Record<string, unknown> => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Malformed TV metadata');
    return value as Record<string, unknown>;
};
const array = (value: unknown): unknown[] => {
    if (!Array.isArray(value)) throw new Error('Malformed TV metadata list');
    return value as unknown[];
};
const integer = (value: unknown, minimum = 0): number => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error('Invalid TV episode number');
    return value;
};

export function seriesCertifications(value: unknown): MovieCertification[] {
    const found = new Map<string, MovieCertification>();
    for (const entry of array(record(value).results)) {
        const row = record(entry);
        if (typeof row.iso_3166_1 !== 'string' || !/^[A-Z]{2}$/.test(row.iso_3166_1) || typeof row.rating !== 'string') throw new Error('Invalid TV certification');
        if (row.rating.trim().length > 0) found.set(row.iso_3166_1, { country: row.iso_3166_1, certification: row.rating.trim() });
    }
    return [...found.values()].sort((a, b) => a.country.localeCompare(b.country));
}

export function catalogEpisodes(value: unknown, season: number): CatalogEpisode[] {
    return array(record(value).episodes).map(entry => {
        const row = record(entry);
        if (integer(row.season_number) !== season || typeof row.name !== 'string') throw new Error('Invalid TV season response');
        if (row.air_date != null && row.air_date !== '' && (typeof row.air_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.air_date))) throw new Error('Invalid TV air date');
        return {
            tmdbid: integer(row.id, 1),
            season,
            number: integer(row.episode_number),
            name: row.name,
            airDate: typeof row.air_date === 'string' && row.air_date.length > 0 ? row.air_date : null,
            runtime: typeof row.runtime === 'number' && row.runtime > 0 ? row.runtime : null
        };
    });
}

/** Shared optional caches; expected episodes never become playable library entries. */
export class SeriesExtras {
    private pending = new Map<number, Promise<SeriesExtrasResult>>();
    private pendingCatalog = new Map<number, Promise<SeriesCatalogResult>>();
    constructor(private provider: Provider) {}

    get(series: Series): Promise<SeriesExtrasResult> {
        const existing = this.pending.get(series.id);
        if (existing) return existing;
        const request = this.refresh(series).finally(() => { this.pending.delete(series.id); });
        this.pending.set(series.id, request);
        return request;
    }

    getCatalog(series: Series): Promise<SeriesCatalogResult> {
        const existing = this.pendingCatalog.get(series.id);
        if (existing) return existing;
        const request = this.refreshCatalog(series).finally(() => { this.pendingCatalog.delete(series.id); });
        this.pendingCatalog.set(series.id, request);
        return request;
    }

    private async refreshCatalog(series: Series): Promise<SeriesCatalogResult> {
        let unavailable = false;
        const fresh = series.catalogUpdatedAt !== null && Date.now() - new Date(series.catalogUpdatedAt).getTime() < DAY;
        if (series.tmdbid !== null && series.tmdbid > 0 && !fresh) {
            const catalog = await optionalMetadata(() => this.catalog(series.tmdbid!), `TV ${series.id} episode catalog`);
            unavailable = catalog === undefined;
            if (catalog !== undefined) await series.update({ episodeCatalog: catalog, catalogUpdatedAt: new Date() }, { silent: true });
        }
        return {
            catalog: series.episodeCatalog ?? null,
            catalogUpdatedAt: series.catalogUpdatedAt ?? null,
            unavailable
        };
    }

    private async catalog(id: number): Promise<EpisodeCatalog> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        const config = { timeout: 5000, signal: controller.signal };
        try {
            const info = record(await this.provider.tvInfo({ id }, config));
            const seasonRows = array(info.seasons).map(record);
            const seasons = seasonRows.map(entry => integer(entry.season_number));
            if (new Set(seasons).size !== seasons.length) throw new Error('Duplicate TV seasons');
            const episodes = Array.from({ length: seasons.length }, (): CatalogEpisode[] => []);
            let cursor = 0;
            // Bound concurrency for long-running shows and abort the whole snapshot on a failure.
            await Promise.all(Array.from({ length: Math.min(4, seasons.length) }, async () => {
                while (cursor < seasons.length) {
                    const index = cursor++;
                    episodes[index] = catalogEpisodes(await this.provider.seasonInfo({ id, season_number: seasons[index] }, config), seasons[index]);
                    const expected = seasonRows[index].episode_count;
                    if (typeof expected === 'number' && expected > episodes[index].length) throw new Error('Incomplete TV season');
                    if (new Set(episodes[index].map(episode => episode.number)).size !== episodes[index].length) throw new Error('Duplicate TV episodes');
                }
            }));
            return { episodes: episodes.flat().sort((a, b) => a.season - b.season || a.number - b.number) };
        } finally {
            controller.abort();
            clearTimeout(timer);
        }
    }

    private async refresh(series: Series): Promise<SeriesExtrasResult> {
        const fresh = (date: Date | null, age: number): boolean => date != null && Date.now() - new Date(date).getTime() < age;
        let unavailable = false;
        if (series.tmdbid !== null && series.tmdbid > 0) {
            const id = series.tmdbid;
            const needsTrailers = !fresh(series.trailersUpdatedAt, 7 * DAY);
            const needsRatings = !fresh(series.certificationsUpdatedAt, 7 * DAY);
            const [trailers, certifications] = await Promise.all([
                needsTrailers ? optionalMetadata(async () => movieTrailers(await this.provider.tvVideos({ id }, { timeout: 5000 })), `TV ${series.id} trailers`) : undefined,
                needsRatings ? optionalMetadata(async () => seriesCertifications(await this.provider.tvContentRatings({ id }, { timeout: 5000 })), `TV ${series.id} ratings`) : undefined
            ]);
            unavailable = (needsTrailers && trailers === undefined) || (needsRatings && certifications === undefined);
            // Preserve the previous complete snapshot on errors, including partial season failures.
            if (trailers !== undefined || certifications !== undefined) await series.update({
                ...(trailers !== undefined ? { trailers, trailersUpdatedAt: new Date() } : {}),
                ...(certifications !== undefined ? { certifications, certificationsUpdatedAt: new Date() } : {})
            }, { silent: true });
        }
        return {
            trailers: series.trailers ?? [],
            certifications: series.certifications ?? [],
            unavailable
        };
    }
}
