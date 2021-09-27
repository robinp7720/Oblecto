import Seedbox from './Seedbox';
import logger from '../../submodules/logger';
import guessit from '../../submodules/guessit';
import { Movie } from '../../models/movie';
import Queue from '../queue';
import { basename } from 'path';
import { rename } from 'fs/promises';

/**
 * @typedef {import('../oblecto').default} Oblecto
 */

export default class SeedboxController {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        logger.log('DEBUG', 'Starting seedbox subsystem');
        this.oblecto = oblecto;
        this.seedBoxes = [];

        this.importQueue = new Queue(1);

        this.importQueue.registerJob('fileImport', job => this.importFile(job.seedbox, job.origin, job.destination));
    }

    loadAllSeedboxes() {
        logger.log('DEBUG', 'Loading all Seedboxes');
        for (const seedbox of this.oblecto.config.seedboxes) {
            this.addSeedbox(seedbox);
        }
    }

    addSeedbox(seedboxConfig) {
        this.seedBoxes.push(new Seedbox(seedboxConfig));
        logger.log('DEBUG', `Loaded seedbox ${seedboxConfig.name}`);
    }

    /**
     *
     * @param {Seedbox} seedbox
     * @param {string} origin
     * @param {string} destination
     * @returns {Promise<void>}
     */
    async importFile(seedbox, origin, destination) {
        logger.log('INFO', `Downloading file from ${seedbox.name}: ${origin}. Saving to ${destination}`);

        // Add a suffix to the file while downloading to prevent potential errors while running an import
        // and also to know if a file was successfully downloaded or not
        await seedbox.storageDriver.copy(origin, destination+'.oblectoimport');
        await rename(destination+'.oblectoimport', destination);

        logger.log('INFO', `${origin} successfully downloaded`);
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

            const match = await this.oblecto.movieIndexer.matchFile(file, await guessit.identify(file));

            const movie = await Movie.findOne({ where: { tmdbid: match.tmdbid } });

            // If the movie doesn't exist in the database,
            // movie will be equal to null.
            // We don't want to download movies that we already have in our library
            // TODO: Add other criteria for choosing which files to download
            //       EG: Matching quality, bitrate, etc
            if (movie !== null) continue;

            logger.log('INFO', `Found new movie on ${seedbox.name}: ${match.movieName}`);

            // Download the file to the first movie directory path
            // TODO: Add config for where imported files should be stored
            this.importQueue.pushJob('fileImport', {
                seedbox,
                origin: file,
                destination: this.oblecto.config.movies.directories[0].path + '/' + basename(file)
            });
        }
    }

    /**
     *
     * @param {Seedbox} seedbox
     */
    importSeries(seedbox) {
        seedbox.findAll(seedbox.seriesPath, ['mkv']);
    }

    importAllMovies() {
        for (const seedbox of this.seedBoxes) this.importMovies(seedbox);
    }
}
