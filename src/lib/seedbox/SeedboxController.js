import Seedbox from './Seedbox';
import logger from '../../submodules/logger';
import MovieIndexer from '../indexers/movies/MovieIndexer';
import guessit from '../../submodules/guessit';
import { Movie } from '../../models/movie';

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
