import TVDB from 'node-tvdb';
import moviedb from 'moviedb-promise';

import Queue from '../queue';
import ImageScaler from '../artwork/ArtworkScaler';
import Downloader from '../downloader';

import SeriesIndexer from '../indexers/series/SeriesIndexer';
import MovieIndexer from '../indexers/movies/MovieIndexer';

import SeriesCollector from '../indexers/series/SeriesCollector';
import MovieCollector from '../indexers/movies/MovieCollector';

import OblectoAPI from '../../submodules/REST';
import RealtimeController from '../realtime/RealtimeController';

import ArtworkUtils from '../artwork/ArtworkUtils';
import MovieArtworkCollector from '../artwork/movies/MovieArtworkCollector';
import SeriesArtworkCollector from '../artwork/series/SeriesArtworkCollector';

import SeriesArtworkDownloader from '../artwork/series/SeriesArtworkDownloader';
import MovieArtworkDownloader from '../artwork/movies/MovieArtworkDownloader';

import FileUpdater from '../updaters/files/FileUpdater';
import SeriesUpdater from '../updaters/series/SeriesUpdater';
import MovieUpdater from '../updaters/movies/MovieUpdater';

import FileUpdateCollector from '../updaters/files/FileUpdateCollector';
import SeriesUpdateCollector from '../updaters/series/SeriesUpdateCollector';
import MovieUpdateCollector from '../updaters/movies/MovieUpdateCollector';

import FederationController from '../federation/server/FederationController';
import FederationClientController from '../federation/client/FederationClientController';

import FederationEpisodeIndexer from '../federationindexer/FederationEpisodeIndexer';
import FederationMovieIndexer from '../federationindexer/FederationMovieIndexer';

import MovieCleaner from '../cleaners/MovieCleaner';
import SeriesCleaner from '../cleaners/SeriesCleaner';
import FileCleaner from '../cleaners/FileCleaner';
import FileIndexer from '../indexers/files/FileIndexer';

export default class Oblecto {
    constructor(config) {
        this.config = config;

        this.tvdb = new TVDB(this.config.tvdb.key);
        this.tmdb = new moviedb(this.config.themoviedb.key);

        this.queue = new Queue(this.config.queue.concurrency);

        this.oblectoAPI = new OblectoAPI(this);
        this.realTimeController = new RealtimeController(this);

        this.downloader = new Downloader(this);

        this.fileIndexer = new FileIndexer(this);
        this.seriesIndexer = new SeriesIndexer(this);
        this.movieIndexer = new MovieIndexer(this);

        this.seriesCollector = new SeriesCollector(this);
        this.movieCollector = new MovieCollector(this);

        this.seriesArtworkDownloader = new SeriesArtworkDownloader(this);
        this.movieArtworkDownloader = new MovieArtworkDownloader(this);

        this.movieArtworkCollector = new MovieArtworkCollector(this);
        this.seriesArtworkCollector = new SeriesArtworkCollector(this);
        this.artworkUtils = new ArtworkUtils(this);
        this.imageScaler = new ImageScaler(this);

        this.fileUpdater = new FileUpdater(this);
        this.seriesUpdater = new SeriesUpdater(this);
        this.movieUpdater = new MovieUpdater(this);

        this.fileUpdateCollector = new FileUpdateCollector(this);
        this.seriesUpdateCollector = new SeriesUpdateCollector(this);
        this.movieUpdateCollector = new MovieUpdateCollector(this);

        this.fileCleaner = new FileCleaner(this);
        this.movieCleaner = new MovieCleaner(this);
        this.seriesCleaner = new SeriesCleaner(this);

        if (config.federation.enabled) {
            this.fedartionController = new FederationController(this);
            this.federationClientController = new FederationClientController(this);

            this.federationEpisodeIndexer = new FederationEpisodeIndexer(this);
            this.federationMovieIndexer = new FederationMovieIndexer(this);

            this.federationClientController.addAllSyncMasters();
        }
    }
}
