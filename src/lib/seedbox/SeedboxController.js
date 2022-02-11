import Seedbox from './Seedbox';
import logger from '../../submodules/logger';
import guessit from '../../submodules/guessit';
import { Movie } from '../../models/movie';
import { File } from '../../models/file';
import Queue from '../queue';
import { basename, parse, dirname } from 'path';
import { rename } from 'fs/promises';
import mkdirp from 'mkdirp';

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

        this.importQueue.registerJob('importMovie', job => this.importMovie(job.seedbox, job.origin, job.destination));
        this.importQueue.registerJob('importEpisode', job => this.importEpisode(job.seedbox, job.origin, job.destination));
    }

    async loadAllSeedboxes() {
        logger.log('DEBUG', 'Loading all Seedboxes');
        for (const seedbox of this.oblecto.config.seedboxes) {
            if (!seedbox.enabled) continue;

            this.addSeedbox(seedbox);
        }

        await this.importAllEpisodes();
        await this.importAllMovies();
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

        mkdirp(dirname(destination));

        // Add a suffix to the file while downloading to prevent potential errors while running an import
        // and also to know if a file was successfully downloaded or not
        await seedbox.storageDriver.copy(origin, destination+'.oblectoimport');
        await rename(destination+'.oblectoimport', destination);

        logger.log('INFO', `${origin} successfully downloaded`);
    }

    async importMovie(seedbox, origin, destination) {
        await this.importFile(seedbox, origin, destination);
        await this.oblecto.movieCollector.collectFile(destination);
    }

    async importEpisode(seedbox, origin, destination) {
        await this.importFile(seedbox, origin, destination);
        await this.oblecto.seriesCollector.collectFile(destination);
    }

    async shouldImportMovie(filePath) {
        const method = 'file';

        if (method === 'movie') {
            const match = await this.oblecto.movieIndexer.matchFile(filePath, await guessit.identify(filePath));
            const movie = await Movie.findOne({ where: { tmdbid: match.tmdbid } });

            return movie === null;
        }

        if (method === 'file') {
            const file = await File.findOne({ where: { name: parse(filePath).name } });

            return file === null;
        }
    }

    async shouldImportEpisode(filePath) {
        const method = 'file';

        // TODO: Add filter based on if episode exits
        if (method === 'episode') {

        }

        if (method === 'file') {
            const file = await File.findOne({ where: { name: parse(filePath).name } });

            return file === null;
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

            if (!await this.shouldImportMovie(file)) continue;

            logger.log('INFO', `Found new movie on ${seedbox.name}: ${basename(file)}`);

            // Download the file to the first movie directory path
            // TODO: Add config for where imported files should be stored
            this.importQueue.pushJob('importMovie', {
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
    async importEpisodes(seedbox) {
        const files = await seedbox.findAll(seedbox.seriesPath, this.oblecto.config.fileExtensions.video);

        for (const file of files) {
            // Many packs include sample files.
            // We don't want to import these
            if (file.toLowerCase().includes('sample')) continue;

            let identification;

            try {
                identification = await this.oblecto.seriesIndexer.identify(file);
            } catch (e) {
                continue;
            }

            if (!await this.shouldImportEpisode(file)) continue;

            logger.log('INFO', `Found new episode on ${seedbox.name}: ${basename(file)}`);

            // Download the file to the first movie directory path
            // TODO: Add config for where imported files should be stored
            this.importQueue.pushJob('importEpisode', {
                seedbox,
                origin: file,
                destination: this.oblecto.config.tvshows.directories[0].path + '/' + identification.seriesName + '/' + basename(file)
            });
        }
    }

    async importAllMovies() {
        for (const seedbox of this.seedBoxes) await this.importMovies(seedbox);
    }

    async importAllEpisodes() {
        for (const seedbox of this.seedBoxes) await this.importEpisodes(seedbox);
    }
}
