import TVDB from 'node-tvdb';
import type { TvdbClient, TvdbEpisode, TvdbSeries } from './tvdbTypes.js';

export type RawTvdbClient = { [K in keyof TvdbClient]: (...args: Parameters<TvdbClient[K]>) => Promise<unknown> };

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid TVDB response');
    return value as Record<string, unknown>;
}
function entity(value: unknown, strings: readonly string[], numbers: readonly string[]): { id: number } & Record<string, unknown> {
    const raw = record(value);
    const id = Number(raw.id);
    if (!((typeof raw.id === 'string' && /^\d+$/.test(raw.id.trim())) || typeof raw.id === 'number') || !Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid TVDB entity ID');
    const result: { id: number } & Record<string, unknown> = { id };
    for (const key of strings) if (typeof raw[key] === 'string') result[key] = raw[key];
    for (const key of numbers) {
        const value = raw[key];
        if ((typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value))) result[key] = Number(value);
    }
    return result;
}
const episode = (value: unknown): TvdbEpisode => entity(value,
    ['episodeName', 'overview', 'firstAired', 'imdbId', 'filename'],
    ['airedEpisodeNumber', 'airedSeason', 'dvdEpisodeNumber', 'dvdSeason', 'absoluteNumber']);
const series = (value: unknown): TvdbSeries => entity(value,
    ['seriesName', 'status', 'firstAired', 'overview', 'rating', 'airsDayOfWeek', 'airsTime', 'network', 'imdbId', 'zap2itId'],
    ['siteRating', 'siteRatingCount']);
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
    if (!Array.isArray(value)) throw new Error('Invalid TVDB list response');
    return value.map(parse);
}

/** The untyped SDK and untrusted response shapes stop at this adapter. */
export class TvdbAdapter implements TvdbClient {
    constructor(private readonly client: RawTvdbClient) {}
    async getSeriesByName(name: string): Promise<TvdbSeries[]> { return list(await this.client.getSeriesByName(name), series); }
    async getSeriesById(id: number): Promise<TvdbSeries> { return series(await this.client.getSeriesById(id)); }
    async getEpisodesBySeriesId(id: number): Promise<TvdbEpisode[]> { return list(await this.client.getEpisodesBySeriesId(id), episode); }
    async getEpisodeById(id: number): Promise<TvdbEpisode> { return episode(await this.client.getEpisodeById(id)); }
    async getSeriesPosters(id: number): Promise<Array<{ fileName: string }>> {
        return list(await this.client.getSeriesPosters(id), value => {
            const raw = record(value);
            if (typeof raw.fileName !== 'string') throw new Error('Invalid TVDB image response');
            return { fileName: raw.fileName };
        });
    }
}

export function createTvdbClient(key: string): TvdbClient {
    const Client = TVDB as unknown as new (key: string) => RawTvdbClient;
    return new TvdbAdapter(new Client(key));
}
