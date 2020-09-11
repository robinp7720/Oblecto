import {promises as fs} from 'fs';

import {Episode} from '../../../models/episode';
import {Series} from '../../../models/series';

export default class SeriesArtworkCollector {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param episode - Episode for which to download the episode banner for
     * @returns {Promise<void>}
     */
    async collectArtworkEpisodeBanner(episode) {
        let stat;

        try {
            stat = await fs.stat(this.oblecto.artworkUtils.episodeBannerPath(episode));
        } catch (e) {}

        if (stat) return;

        this.oblecto.queue.queueJob('downloadEpisodeBanner', episode);
    }

    /**
     *
     * @param series - Series for which to download the series poster for
     * @returns {Promise<void>}
     */
    async collectArtworkSeriesPoster(series) {
        let stat;

        try {
            stat = await fs.stat(this.oblecto.artworkUtils.seriesPosterPath(series));
        } catch (e) {}

        if (stat) return;

        this.oblecto.queue.queueJob('downloadSeriesPoster', series);
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAllEpisodeBanners() {
        let episodes = await Episode.findAll();

        for (let episode of episodes) {
            this.collectArtworkEpisodeBanner(episode);
        }
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAllSeriesPosters() {
        let allSeries = await Series.findAll();

        for (let series of allSeries) {
            this.collectArtworkSeriesPoster(series);
        }
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAll() {
        await this.collectAllEpisodeBanners();
        await this.collectAllSeriesPosters();
    }
}
