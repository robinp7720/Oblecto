import axios from 'axios';
import {promises as fs} from 'fs';
import util from 'util';

import Queue from '../queue';
import SeriesIndexer from '../indexers/series/SeriesIndexer';
import MovieIndexer from '../indexers/movies/MovieIndexer';

import SeriesCollector from '../indexers/series/SeriesCollector';
import MovieCollector from '../indexers/movies/MovieCollector';

import OblectoAPI from '../../submodules/REST';
import RealtimeController from '../realtime/RealtimeController';

import ArtworkUtils from '../artwork/ArtworkUtils';
import MovieArtworkCollector from '../artwork/movies/MovieArtworkCollector';
import SeriesArtworkCollector from '../artwork/series/SeriesArtworkCollector';
import Downloader from '../downloader';

import SeriesArtworkDownloader from '../artwork/series/SeriesArtworkDownloader';
import MovieArtworkDownloader from '../artwork/movies/MovieArtworkDownloader';

import ImageScaler from '../artwork/ArtworkScaler';

import SeriesUpdater from '../updaters/series/SeriesUpdater';
import MovieUpdater from '../updaters/movies/MovieUpdater';

import SeriesUpdateCollector from '../updaters/series/SeriesUpdateCollector';
import FederationController from '../federation/server/FederationController';
import FederationClientController from '../federation/client/FederationClientController';
import MovieUpdateCollector from '../updaters/movies/MovieUpdateCollector';

export default class Oblecto {
    constructor(config) {
        this.config = config;

        this.queue = new Queue(this.config.queue.concurrency);

        this.oblectoAPI = new OblectoAPI(this);
        this.realTimeController = new RealtimeController(this);

        this.seriesIndexer = new SeriesIndexer(this);
        this.movieIndexer = new MovieIndexer(this);

        this.seriesCollector = new SeriesCollector(this);
        this.movieCollector = new MovieCollector(this);

        this.seriesArtworkDownloader = new SeriesArtworkDownloader(this);
        this.movieArtworkDownloader = new MovieArtworkDownloader(this);

        this.movieArtworkCollector = new MovieArtworkCollector(this);
        this.seriesArtworkCollector = new SeriesArtworkCollector(this);
        this.artworkUtils = new ArtworkUtils(this);

        this.seriesUpdater = new SeriesUpdater(this);
        this.movieUpdater = new MovieUpdater(this);

        this.seriesUpdateCollector = new SeriesUpdateCollector(this);
        this.movieUpdateCollector = new MovieUpdateCollector(this);

        this.fedartionController = new FederationController(this);
        this.federationClientController = new FederationClientController(this);

        this.federationClientController.addSyncMaster('oblecto');

        //this.seriesUpdateCollector.collectAllSeries();
        //this.seriesUpdateCollector.collectAllEpisodes();

        this.movieUpdateCollector.collectAllMovies();

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
            await this.seriesUpdater.updateEpisode(job);
        });

        this.queue.addJob('updateSeries', async (job) => {
            await this.seriesUpdater.updateSeries(job);
        });

        this.queue.addJob('updateMovie', async (job) => {
            await this.movieUpdater.updateMovie(job);
        });

        this.queue.addJob('downloadEpisodeBanner', async (job) => {
            await this.seriesArtworkDownloader.downloadEpisodeBanner(job);
        });

        this.queue.addJob('downloadSeriesPoster', async (job) => {
            await this.seriesArtworkDownloader.downloadSeriesPoster(job);
        });

        this.queue.addJob('downloadMoviePoster', async (job) => {
            await this.movieArtworkDownloader.downloadMoviePoster(job);
        });

        this.queue.addJob('downloadMovieFanart', async (job) => {
            await this.movieArtworkDownloader.downloadMovieFanart(job);
        });

        this.queue.addJob('rescaleImage', async (job) => {
            await ImageScaler.rescaleImage(job.from, job.to, {
                width: job.width,
                height: job.height
            });
        });

        this.queue.addJob('downloadFile', async (job) => {
            await Downloader.download(job.url, job.dest, job.overwrite);
        });
    }
}
