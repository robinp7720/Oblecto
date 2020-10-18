import {Series} from '../../../models/series';
import {Episode} from '../../../models/episode';

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
     * @param {Episode} episode - Episode for which to download the episode banner for
     * @returns {Promise<void>}
     */
    async collectEpisode(episode) {
        this.oblecto.queue.queueJob('updateEpisode', episode);
    }

    /**
     *
     * @param {Series} series - Series for which to download the series poster for
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
        let episodes = await Episode.findAll();

        for (let episode of episodes) {
            await this.collectEpisode(episode);
        }
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async collectAllSeries() {
        let all = await Series.findAll();

        for (let series of all) {
            await this.collectSeries(series);
        }
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
