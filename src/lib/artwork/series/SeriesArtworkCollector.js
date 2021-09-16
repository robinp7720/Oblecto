import { Episode } from '../../../models/episode';
import { Series } from '../../../models/series';
/**
 * @typedef {import('../../oblecto').default} Oblecto
 */
import { fileExists } from '../../../submodules/utils';

export default class SeriesArtworkCollector {
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param {Episode} episode - Episode for which to download the episode banner for
     * @returns {Promise<void>}
     */
    async collectArtworkEpisodeBanner(episode) {
        if (await fileExists(this.oblecto.artworkUtils.episodeBannerPath(episode))) return;

        this.oblecto.queue.queueJob('downloadEpisodeBanner', episode);
    }

    /**
     *
     * @param {Series} series - Series for which to download the series poster for
     * @returns {Promise<void>}
     */
    async collectArtworkSeriesPoster(series) {
        if (await fileExists(this.oblecto.artworkUtils.seriesPosterPath(series))) return;

        this.oblecto.queue.queueJob('downloadSeriesPoster', series);
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAllEpisodeBanners() {
        let episodes = await Episode.findAll();

        for (let episode of episodes) {
            await this.collectArtworkEpisodeBanner(episode);
        }
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAllSeriesPosters() {
        let allSeries = await Series.findAll();

        for (let series of allSeries) {
            await this.collectArtworkSeriesPoster(series);
        }
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAll() {
        await this.collectAllSeriesPosters();
        await this.collectAllEpisodeBanners();
    }
}
