import axios from 'axios';
import fs from 'fs';
import util from 'util';

import Queue from '../queue';
import SeriesIndexer from '../indexers/series/SeriesIndexer';
import MovieIndexer from '../indexers/movies/MovieIndexer';

import SeriesCollector from '../indexers/series/SeriesCollector';
import MovieCollector from '../indexers/movies/MovieCollector';

import OblectoAPI from '../../submodules/REST';
import RealtimeController from '../realtime/RealtimeController';
import AggregateMovieArtworkRetriever from '../artwork/movies/AggregateMovieArtworkRetriever';
import AggregateSeriesArtworkRetriever from '../artwork/series/AggregateSeriesArtworkRetriever';
import TmdbMovieArtworkRetriever from '../artwork/movies/artworkRetrievers/TmdbMovieArtworkRetriever';
import TmdbSeriesArtworkRetriever from '../artwork/series/artworkRetrievers/TmdbSeriesArtworkRetriever';

export default class Oblecto {
    constructor(config) {
        this.config = config;

        this.oblectoAPI = new OblectoAPI(this);
        this.realTimeController = new RealtimeController(this);

        this.seriesIndexer = new SeriesIndexer(this);
        this.movieIndexer = new MovieIndexer(this);

        this.seriesCollector = new SeriesCollector(this);
        this.movieCollector = new MovieCollector(this);

        this.movieArtworkRetriever = new AggregateMovieArtworkRetriever();
        this.seriesArtworkRetriever = new AggregateSeriesArtworkRetriever();

        this.movieArtworkRetriever.loadRetriever(new TmdbMovieArtworkRetriever());
        this.seriesArtworkRetriever.loadRetriever(new TmdbSeriesArtworkRetriever());

        this.queue = new Queue(this.config.queue.concurrency);

        this.setupQueue();
    }

    setupQueue () {
        this.queue.addJob('indexEpisode', async (job) => {
            await this.seriesIndexer.indexFile(job.path);
        });

        this.queue.addJob('indexMovie', async (job) => {
            await this.movieIndexer.indexFile(job.path);
        });

        this.queue.addJob('updateEpisode', async (job) => {
            //await this.movieIndexer.indexFile(job.path);
        });

        this.queue.addJob('updateSeries', async (job) => {
            //await this.movieIndexer.indexFile(job.path);
        });

        this.queue.addJob('updateMovie', async (job) => {
            //await this.movieIndexer.indexFile(job.path);
        });

        this.queue.addJob('downloadEpisodeBanner', async (job) => {
            let url = await this.seriesArtworkRetriever.retrieveEpisodeBanner(job);

            if (!url) return;

            this.queue.pushJob('downloadFile', {
                url,
                dest: `${this.config.assets.episodeBannerLocation}/${job.id}.jpg`
            });
        });

        this.queue.addJob('downloadSeriesPoster', async (job) => {
            let url = await this.seriesArtworkRetriever.retrieveSeriesPoster(job);

            if (!url) return;

            this.queue.pushJob('downloadFile', {
                url,
                dest: `${this.config.assets.showPosterLocation}/${job.id}.jpg`
            });
        });

        this.queue.addJob('downloadMoviePoster', async (job) => {
            let url = await this.movieArtworkRetriever.retrievePoster(job);

            if (!url) return;

            this.queue.pushJob('downloadFile', {
                url,
                dest: `${this.config.assets.moviePosterLocation}/${job.id}.jpg`
            });
        });

        this.queue.addJob('downloadMovieFanart', async (job) => {
            let url = await this.movieArtworkRetriever.retrieveFanart(job);

            if (!url) return;

            this.queue.pushJob('downloadFile', {
                url,
                dest: `${this.config.assets.movieFanartLocation}/${job.id}.jpg`
            });
        });

        this.queue.addJob('downloadFile', async (job) => {
            console.log('Downloading', job.url, job.dest);
            axios({
                method: 'get',
                url: job.url,
                responseType: 'stream'
            }).then(response => {
                response.data.pipe(fs.createWriteStream(job.dest));
            }).catch(err => {
                fs.unlink(job.dest);
            });
        });
    }
}
