import {promises as fs} from 'fs';

import databases from '../../../submodules/database';

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
        let allEpisodes = databases.episode.findAll();

        allEpisodes.each((episode) => {
            this.collectArtworkEpisodeBanner(episode);
        });
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAllSeriesPosters() {
        let allSeries = databases.tvshow.findAll();

        allSeries.each((series) => {
            this.collectArtworkSeriesPoster(series);
        });
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
