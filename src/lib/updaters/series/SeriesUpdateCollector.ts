import { Series } from '../../../models/series.js';
import { Episode } from '../../../models/episode.js';

import type Oblecto from '../../oblecto/index.js';

export default class SeriesUpdateCollector {
    public oblecto: Oblecto;

    /**
     *
     * @param oblecto - Oblecto server instance
     */
    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;
    }

    /**
     *
     * @param episode - Episode for which to download the episode banner for
     */
    async collectEpisode(episode: Episode): Promise<void> {
        this.oblecto.queue.queueJob('updateEpisode', episode);
    }

    /**
     *
     * @param series - Series for which to download the series poster for
     */
    async collectSeries(series: Series): Promise<void> {
        this.oblecto.queue.queueJob('updateSeries', series);
    }

    /**
     *
     */
    async collectAllEpisodes(): Promise<void> {
        const episodes = await Episode.findAll();

        for (const episode of episodes) {
            await this.collectEpisode(episode);
        }
    }

    /**
     *
     */
    async collectAllSeries(): Promise<void> {
        const all = await Series.findAll();

        for (const series of all) {
            await this.collectSeries(series);
        }
    }

    /**
     *
     */
    async collectAll(): Promise<void> {
        await this.collectAllEpisodes();
        await this.collectAllSeries();
    }
}
