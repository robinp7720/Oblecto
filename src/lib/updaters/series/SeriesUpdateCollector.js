import databases from '../../../submodules/database';

export default class SeriesUpdateCollector {
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
    async collectEpisode(episode) {
        this.oblecto.queue.queueJob('updateEpisode', episode);
    }

    /**
     *
     * @param series - Series for which to download the series poster for
     * @returns {Promise<void>}
     */
    async collectSeries(series) {
        this.oblecto.queue.queueJob('updateSeries', series);
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAllEpisodes() {
        let allEpisodes = databases.episode.findAll();

        allEpisodes.each((episode) => {
            this.collectEpisode(episode);
        });
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAllSeries() {
        let allSeries = databases.tvshow.findAll();

        allSeries.each((series) => {
            this.collectSeries(series);
        });
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAll() {
        await this.collectAllEpisodes();
        await this.collectAllSeries();
    }
}
