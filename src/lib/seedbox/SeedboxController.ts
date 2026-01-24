import Seedbox from './Seedbox.js';
import logger from '../../submodules/logger/index.js';
import { Movie } from '../../models/movie.js';
import { File } from '../../models/file.js';
import Queue from '../queue/index.js';
import { basename, parse, dirname } from 'path';
import path from 'path';
import { rename } from 'fs/promises';
import { mkdirp } from 'mkdirp';

import type Oblecto from '../oblecto/index.js';

export default class SeedboxController {
    public oblecto: Oblecto;
    public seedBoxes: Seedbox[];
    public importQueue: Queue;

    /**
     *
     * @param oblecto
     */
    constructor(oblecto: Oblecto) {
        logger.debug( 'Starting seedbox subsystem');
        this.oblecto = oblecto;
        this.seedBoxes = [];

        this.importQueue = new Queue(oblecto.config.seedboxImport.concurrency);

        this.importQueue.registerJob('importMovie', async (job: { seedbox: Seedbox; origin: string; destination: string }) => await this.importMovie(job.seedbox, job.origin, job.destination));
        this.importQueue.registerJob('importEpisode', async (job: { seedbox: Seedbox; origin: string; destination: string }) => await this.importEpisode(job.seedbox, job.origin, job.destination));
    }

    async loadAllSeedboxes(): Promise<void> {
        logger.debug( 'Loading all Seedboxes');
        for (const seedbox of this.oblecto.config.seedboxes) {
            if (!seedbox.enabled) continue;

            await this.addSeedbox(seedbox);
        }

        await this.importAllEpisodes();
        await this.importAllMovies();

        setInterval(() => {
            void (async () => {
                await this.importAllEpisodes();
                await this.importAllMovies();
            })();
        },
        30 * 60 * 1000
        );
    }

    async addSeedbox(seedboxConfig: Parameters<typeof Seedbox>[0]): Promise<void> {
        const newSeedbox = new Seedbox(seedboxConfig);

        await newSeedbox.setupDriver();

        this.seedBoxes.push(newSeedbox);
        logger.debug( `Loaded seedbox ${seedboxConfig.name}`);
    }

    /**
     *
     * @param seedbox
     * @param origin
     * @param destination
     */
    async importFile(seedbox: Seedbox, origin: string, destination: string): Promise<void> {
        logger.info( `Downloading file from ${seedbox.name}: ${origin}. Saving to ${destination}`);

        this.oblecto.realTimeController.broadcast('seedbox', {
            event: 'import_start',
            seedbox: seedbox.name,
            origin,
            destination
        });

        mkdirp.sync(dirname(destination));

        try {
            // Add a suffix to the file while downloading to prevent potential errors while running an import
            // and also to know if a file was successfully downloaded or not
            await seedbox.storageDriver.copy(origin, destination + '.oblectoimport');
            await rename(destination + '.oblectoimport', destination);

            logger.info( `${origin} successfully downloaded`);

            this.oblecto.realTimeController.broadcast('seedbox', {
                event: 'import_success',
                seedbox: seedbox.name,
                origin,
                destination
            });
        } catch (e) {
            logger.error( `Could not download ${origin}:`, e);
            
            this.oblecto.realTimeController.broadcast('seedbox', {
                event: 'import_error',
                seedbox: seedbox.name,
                origin,
                destination,
                error: (e as Error).message
            });
        }
    }

    async importMovie(seedbox: Seedbox, origin: string, destination: string): Promise<void> {
        await this.importFile(seedbox, origin, destination);
        await this.oblecto.movieCollector.collectFile(destination);
    }

    async importEpisode(seedbox: Seedbox, origin: string, destination: string): Promise<void> {
        await this.importFile(seedbox, origin, destination);
        await this.oblecto.seriesCollector.collectFile(destination);
    }

    alreadyImportingFile(filePath: string): boolean {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const tasks = (this.importQueue as any).queue._tasks as Array<{ attr: { origin: string } }>;

        for (const task of tasks) {
            if (task.attr.origin === filePath) {
                return true;
            }
        }

        return false;
    }

    async fileAlreadyImported(filePath: string): Promise<boolean> {
        const file = await File.findOne({ where: { name: parse(filePath).name } });

        return file !== null;
    }

    async shouldImportMovie(filePath: string, movie_match: { tmdbid?: number; movieName?: string }): Promise<boolean | undefined> {
        const method = 'file';

        if (method === 'movie') {
            const movie = await Movie.findOne({ where: { tmdbid: movie_match.tmdbid } });

            return movie === null;
        }

        if (method === 'file') {
            return !await this.fileAlreadyImported(filePath);
        }
    }

    async shouldImportEpisode(filePath: string): Promise<boolean | undefined> {
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
     * @param seedbox
     */
    async importMovies(seedbox: Seedbox): Promise<void> {
        const files = await seedbox.findAll(seedbox.moviePath, this.oblecto.config.fileExtensions.video);

        for (const file of files) {
            // Many packs include sample files.
            // We don't want to import these
            if (file.toLowerCase().includes('sample')) continue;

            if (this.alreadyImportingFile(file)) continue;
            if (await this.fileAlreadyImported(file)) continue;

            let movie_match: { tmdbid?: number; movieName?: string } | null = null;

            try {
                movie_match = await this.oblecto.movieIndexer.matchFile(file);
            } catch (e) {
                logger.info( `Could not identify ${file}`);
                continue;
            }

            if (!movie_match) continue;

            if (!await this.shouldImportMovie(file, movie_match)) {
                logger.info( `Not importing ${movie_match.movieName}`);
                continue;
            }

            logger.info( `Found new movie on ${seedbox.name}: ${basename(file)}`);

            const movie_data = await this.oblecto.movieUpdater.aggregateMovieUpdateRetriever.retrieveInformation(movie_match as any) as { releaseDate?: string };

            const releaseYear = movie_data.releaseDate ? movie_data.releaseDate.substr(0, 4) : '0000';

            const destination = path.join(
                this.oblecto.config.movies.directories[0].path,
                `${movie_match.movieName} (${releaseYear})`,
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
     * @param seedbox
     */
    async importEpisodes(seedbox: Seedbox): Promise<void> {
        const files = await seedbox.findAll(seedbox.seriesPath, this.oblecto.config.fileExtensions.video);

        for (const file of files) {
            // Many packs include sample files.
            // We don't want to import these
            if (file.toLowerCase().includes('sample')) continue;

            if (this.alreadyImportingFile(file)) continue;

            let identification: { series: { seriesName: string } } | undefined;

            try {
                identification = await this.oblecto.seriesIndexer.identify(file);
            } catch (e) {
                continue;
            }

            if (!identification) continue;

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

    async importAllMovies(): Promise<void> {
        for (const seedbox of this.seedBoxes) {
            await this.importMovies(seedbox);
        }
    }

    async importAllEpisodes(): Promise<void> {
        for (const seedbox of this.seedBoxes) await this.importEpisodes(seedbox);
    }
}
