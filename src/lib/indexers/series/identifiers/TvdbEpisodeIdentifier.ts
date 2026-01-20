import IdentificationError from '../../../errors/IdentificationError.js';
import EpisodeIdentifier, { EpisodeGuessitIdentification, EpisodeIdentification } from '../EpisodeIdentifier.js';
import promiseTimeout from '../../../../submodules/promiseTimeout.js';

import type Oblecto from '../../../oblecto/index.js';
import type { SeriesIdentification } from '../SeriesIdentifer.js';

export default class TvdbEpisodeIdentifier extends EpisodeIdentifier {
    public episodeCache: Record<number, Array<{
        id: number;
        imdbId?: string;
        episodeName?: string;
        airedEpisodeNumber?: number;
        airedSeason?: number;
        dvdEpisodeNumber?: number;
        dvdSeason?: number;
        absoluteNumber?: number;
        overview?: string;
        firstAired?: string;
    }>>;

    constructor(oblecto: Oblecto) {
        super(oblecto);

        this.episodeCache = {};
    }

    /**
     * Get all episodes from TVDB from a given TVDB series id
     * @param tvdbId - TVDBID for the series to get episodes for
     * @returns - Object containing all episodes of a series
     */
    async getEpisodes(tvdbId: number) {
        // TODO: Caching should be moved somewhere else or at least improved. This implementation is terrible
        if (this.episodeCache[tvdbId]) {
            return this.episodeCache[tvdbId];
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.episodeCache[tvdbId] = await promiseTimeout(this.oblecto.tvdb.getEpisodesBySeriesId(tvdbId));

        return this.episodeCache[tvdbId];
    }

    /**
     * Match an episode to given guessit identification
     * @param series - series to a match a guessit identification to
     * @param guessitIdentification - Guessit identification of a file
     * @returns - Match an episode to a guessit Identification
     */
    async retrieveEpisode(series: SeriesIdentification, guessitIdentification: EpisodeGuessitIdentification) {
        if (!series.tvdbid) throw new IdentificationError('tvdbid was not supplied');
        const tvdbEpisodes = await this.getEpisodes(series.tvdbid);

        for (const episode of tvdbEpisodes) {
            if (episode.episodeName === guessitIdentification.episode_name) return episode;

            if (episode.airedSeason !== guessitIdentification.season) continue;
            if (episode.airedEpisodeNumber !== guessitIdentification.episode) continue;

            return episode;
        }

        throw new IdentificationError(
            `No matching episode found for series "${series.seriesName || series.tvdbid}". ` +
            `Looking for: ${guessitIdentification.episode_name ? `episode name "${guessitIdentification.episode_name}"` : ''} ` +
            `${guessitIdentification.season ? `S${guessitIdentification.season}` : ''}` +
            `${guessitIdentification.episode ? `E${guessitIdentification.episode}` : ''}`
        );
    }

    /**
     *  Identify an episode using TVDB
     * @param path - Path to the episode to be identified
     * @param guessitIdentification - Guessit identification object
     * @param series - Series to which the episode should belong
     * @returns - Returns a metadata object for an episode
     */
    async identify(path: string, guessitIdentification: EpisodeGuessitIdentification, series: SeriesIdentification): Promise<EpisodeIdentification> {
        const episode = await this.retrieveEpisode(series, guessitIdentification);

        return {
            tvdbid: episode.id,
            imdbid: episode.imdbId,

            episodeName: episode.episodeName,

            airedEpisodeNumber: episode.airedEpisodeNumber,
            airedSeason: episode.airedSeason,
            dvdEpisodeNumber: episode.dvdEpisodeNumber,
            dvdSeason: episode.dvdSeason,

            absoluteNumber: episode.absoluteNumber,

            overview: episode.overview,
            firstAired: episode.firstAired
        };
    }
}
