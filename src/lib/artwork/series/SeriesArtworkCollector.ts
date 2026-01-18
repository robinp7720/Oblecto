import { Episode } from '../../../models/episode.js';
import { Series } from '../../../models/series.js';
import { fileExists } from '../../../submodules/utils.js';

import type Oblecto from '../../oblecto/index.js';

export default class SeriesArtworkCollector {
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
    async collectArtworkEpisodeBanner(episode: Episode): Promise<void> {
        if (await fileExists(this.oblecto.artworkUtils.episodeBannerPath(episode))) return;

        this.oblecto.queue.queueJob('downloadEpisodeBanner', episode);
    }

    /**
     *
     * @param series - Series for which to download the series poster for
     */
    async collectArtworkSeriesPoster(series: Series): Promise<void> {
        if (await fileExists(this.oblecto.artworkUtils.seriesPosterPath(series))) return;

        this.oblecto.queue.queueJob('downloadSeriesPoster', series);
    }

    /**
     *
     */
    async collectAllEpisodeBanners(): Promise<void> {
        const episodes = await Episode.findAll();

        for (const episode of episodes) {
            await this.collectArtworkEpisodeBanner(episode);
        }
    }

    /**
     *
     */
    async collectAllSeriesPosters(): Promise<void> {
        const allSeries = await Series.findAll();

        for (const series of allSeries) {
            await this.collectArtworkSeriesPoster(series);
        }
    }

    /**
     *
     */
    async collectAll(): Promise<void> {
        await this.collectAllSeriesPosters();
        await this.collectAllEpisodeBanners();
    }
}
