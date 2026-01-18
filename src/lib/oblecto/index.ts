import TVDB from 'node-tvdb';
import { MovieDb } from 'moviedb-promise';

import Queue from '../queue/index.js';
import ImageScaler from '../artwork/ArtworkScaler.js';
import Downloader from '../downloader/index.js';

import SeriesIndexer from '../indexers/series/SeriesIndexer.js';
import MovieIndexer from '../indexers/movies/MovieIndexer.js';

import SeriesCollector from '../indexers/series/SeriesCollector.js';
import MovieCollector from '../indexers/movies/MovieCollector.js';

import OblectoAPI from '../../submodules/REST/index.js';
import RealtimeController from '../realtime/RealtimeController.js';

import ArtworkUtils from '../artwork/ArtworkUtils.js';
import MovieArtworkCollector from '../artwork/movies/MovieArtworkCollector.js';
import SeriesArtworkCollector from '../artwork/series/SeriesArtworkCollector.js';

import SeriesArtworkDownloader from '../artwork/series/SeriesArtworkDownloader.js';
import MovieArtworkDownloader from '../artwork/movies/MovieArtworkDownloader.js';

import FileUpdater from '../updaters/files/FileUpdater.js';
import SeriesUpdater from '../updaters/series/SeriesUpdater.js';
import MovieUpdater from '../updaters/movies/MovieUpdater.js';

import FileUpdateCollector from '../updaters/files/FileUpdateCollector.js';
import SeriesUpdateCollector from '../updaters/series/SeriesUpdateCollector.js';
import MovieUpdateCollector from '../updaters/movies/MovieUpdateCollector.js';

import FederationController from '../federation/server/FederationController.js';
import FederationClientController from '../federation/client/FederationClientController.js';

import FederationEpisodeIndexer from '../federationindexer/FederationEpisodeIndexer.js';
import FederationMovieIndexer from '../federationindexer/FederationMovieIndexer.js';

import MovieCleaner from '../cleaners/MovieCleaner.js';
import SeriesCleaner from '../cleaners/SeriesCleaner.js';
import FileCleaner from '../cleaners/FileCleaner.js';
import FileIndexer from '../indexers/files/FileIndexer.js';

import { initDatabase } from '../../submodules/database.js';
import StreamSessionController from '../streamSessions/StreamSessionController.js';
import SeedboxController from '../seedbox/SeedboxController.js';
import EmbyEmulation from '../embyEmulation/index.js';

import { IConfig } from '../../interfaces/config.js';
import { Sequelize } from 'sequelize';

export default class Oblecto {
    public config: IConfig;
    public database: Sequelize;
    public tvdb: any;
    public tmdb: any;
    public queue: any;
    public downloader: any;
    public fileIndexer: any;
    public seriesIndexer: any;
    public movieIndexer: any;
    public seriesCollector: any;
    public movieCollector: any;
    public seriesArtworkDownloader: any;
    public movieArtworkDownloader: any;
    public movieArtworkCollector: any;
    public seriesArtworkCollector: any;
    public artworkUtils: any;
    public imageScaler: any;
    public fileUpdater: any;
    public seriesUpdater: any;
    public movieUpdater: any;
    public fileUpdateCollector: any;
    public seriesUpdateCollector: any;
    public movieUpdateCollector: any;
    public fileCleaner: any;
    public movieCleaner: any;
    public seriesCleaner: any;
    public streamSessionController: any;
    public seedboxController: any;
    public federationController: any;
    public federationClientController: any;
    public federationEpisodeIndexer: any;
    public federationMovieIndexer: any;
    public oblectoAPI: any;
    public realTimeController: any;
    public embyServer: any;

    constructor(config: IConfig) {
        this.config = config;

        this.database = initDatabase();

        this.tvdb = new (TVDB as any)(this.config.tvdb.key);
        this.tmdb = new MovieDb(this.config.themoviedb.key);

        this.queue = new Queue(this.config.queue.concurrency);

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

        this.streamSessionController = new StreamSessionController(this);

        this.seedboxController = new SeedboxController(this);
        this.seedboxController.loadAllSeedboxes();

        if (this.config.federation.enable) {
            this.federationController = new FederationController(this);
            this.federationClientController = new FederationClientController(this);

            this.federationEpisodeIndexer = new FederationEpisodeIndexer(this);
            this.federationMovieIndexer = new FederationMovieIndexer(this);

            this.federationClientController.addAllSyncMasters();
        }

        this.oblectoAPI = new OblectoAPI(this);
        this.realTimeController = new RealtimeController(this);

        // Emby Server emulation
        this.embyServer = new EmbyEmulation(this);
    }

    close() {
        for (const item of Object.keys(this)) {
            const member = (this as any)[item];

            if (member && member.close) {
                member.close();
            }
        }
    }
}
