import Seedbox from './Seedbox';
import logger from '../../submodules/logger';
import guessit from '../../submodules/guessit';
import { Movie } from '../../models/movie';
import { File } from '../../models/file';
import Queue from '../queue';
import { basename, parse, dirname } from 'path';
import path from 'path';
import { rename } from 'fs/promises';
import { mkdirp } from 'mkdirp';

/**
 * @typedef {import('../oblecto').default} Oblecto
 */

export default class SeedboxController {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        logger.debug( 'Starting seedbox subsystem');
        this.oblecto = oblecto;
        this.seedBoxes = [];

        this.importQueue = new Queue(oblecto.config.seedboxImport.concurrency);

        this.importQueue.registerJob('importMovie', async job => await this.importMovie(job.seedbox, job.origin, job.destination));
        this.importQueue.registerJob('importEpisode', async job => await this.importEpisode(job.seedbox, job.origin, job.destination));
    }

    async loadAllSeedboxes() {
        logger.debug( 'Loading all Seedboxes');
        for (const seedbox of this.oblecto.config.seedboxes) {
            if (!seedbox.enabled) continue;

            await this.addSeedbox(seedbox);
        }

        await this.importAllEpisodes();
        await this.importAllMovies();

        setInterval(async () => {
            await this.importAllEpisodes();
            await this.importAllMovies();
        },
        30 * 60 * 1000
        );
    }

    async addSeedbox(seedboxConfig) {
        const newSeedbox = new Seedbox(seedboxConfig);

        await newSeedbox.setupDriver();

        this.seedBoxes.push(newSeedbox);
        logger.debug( `Loaded seedbox ${seedboxConfig.name}`);
    }

    /**
     *
     * @param {Seedbox} seedbox
     * @param {string} origin
     * @param {string} destination
     * @returns {Promise<void>}
     */
    async importFile(seedbox, origin, destination) {
        logger.info( `Downloading file from ${seedbox.name}: ${origin}. Saving to ${destination}`);

        mkdirp.sync(dirname(destination));

        try {
            // Add a suffix to the file while downloading to prevent potential errors while running an import
            // and also to know if a file was successfully downloaded or not
            await seedbox.storageDriver.copy(origin, destination + '.oblectoimport');
            await rename(destination + '.oblectoimport', destination);

            logger.info( `${origin} successfully downloaded`);
        } catch (e) {
            logger.error( `Could not download ${origin}:`, e);
        }
    }

    async importMovie(seedbox, origin, destination) {
        await this.importFile(seedbox, origin, destination);
        await this.oblecto.movieCollector.collectFile(destination);
    }

    async importEpisode(seedbox, origin, destination) {
        await this.importFile(seedbox, origin, destination);
        await this.oblecto.seriesCollector.collectFile(destination);
    }

    alreadyImportingFile(filePath) {
        for (let i of this.importQueue.queue._tasks) {
            if (i.attr.origin === filePath) {
                return true;
            }
        }

        return false;
    }

    async fileAlreadyImported(filePath) {
        const file = await File.findOne({ where: { name: parse(filePath).name } });

        return file !== null;
    }

    async shouldImportMovie(filePath, movie_match) {
        const method = 'file';

        if (method === 'movie') {
            const movie = await Movie.findOne({ where: { tmdbid: movie_match.tmdbid } });

            return movie === null;
        }

        if (method === 'file') {
            return !await this.fileAlreadyImported(filePath);
        }
    }

    async shouldImportEpisode(filePath) {
        const method = 'file';

        if (method === 'episode') {
            // TODO: Add filter based on if episode exits
        }

        if (method === 'file') {
            return !await this.fileAlreadyImported(filePath);
        }
    }

    /**
     *
     * @param {Seedbox} seedbox
     */
    async importMovies(seedbox) {
        const files = await seedbox.findAll(seedbox.moviePath, this.oblecto.config.fileExtensions.video);

        for (const file of files) {
            // Many packs include sample files.
            // We don't want to import these
            if (file.toLowerCase().includes('sample')) continue;

            if (this.alreadyImportingFile(file)) continue;
            if (await this.fileAlreadyImported(file)) continue;

            let movie_match = null;

            try {
                movie_match = await this.oblecto.movieIndexer.matchFile(file);
            } catch (e) {
                logger.info( `Could not identify ${file}`);
                continue;
            }

            if (!await this.shouldImportMovie(file, movie_match)) {
                logger.info( `Not importing ${movie_match.movieName}`);
                continue;
            }

            logger.info( `Found new movie on ${seedbox.name}: ${basename(file)}`);

            const movie_data = await this.oblecto.movieUpdater.aggregateMovieUpdateRetriever.retrieveInformation(movie_match);

            const destination = path.join(
                this.oblecto.config.movies.directories[0].path,
                `${movie_match.movieName} (${movie_data.releaseDate.substr(0, 4)})`,
                basename(file)
            );

            // Download the file to the first movie directory path
            // TODO: Add config for where imported files should be stored
            this.importQueue.pushJob('importMovie', {
                seedbox,
                origin: file,
                destination
            });
        }
    }

    /**
     *
     * @param {Seedbox} seedbox
     */
    async importEpisodes(seedbox) {
        const files = await seedbox.findAll(seedbox.seriesPath, this.oblecto.config.fileExtensions.video);

        for (const file of files) {
            // Many packs include sample files.
            // We don't want to import these
            if (file.toLowerCase().includes('sample')) continue;

            if (this.alreadyImportingFile(file)) continue;

            let identification;

            try {
                identification = await this.oblecto.seriesIndexer.identify(file);
            } catch (e) {
                continue;
            }

            if (!await this.shouldImportEpisode(file)) continue;

            logger.info( `Found new episode on ${seedbox.name}: ${basename(file)}`);

            const destination = path.join(
                this.oblecto.config.tvshows.directories[0].path,
                identification.series.seriesName,
                basename(file)
            );

            // Download the file to the first movie directory path
            // TODO: Add config for where imported files should be stored
            this.importQueue.pushJob('importEpisode', {
                seedbox,
                origin: file,
                destination
            });
        }
    }

    async importAllMovies() {
        for (const seedbox of this.seedBoxes) {
            await this.importMovies(seedbox);
        }
    }

    async importAllEpisodes() {
        for (const seedbox of this.seedBoxes) await this.importEpisodes(seedbox);
    }
}
