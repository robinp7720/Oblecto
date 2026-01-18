import AggregateUpdateRetriever from '../../common/AggregateUpdateRetriever.js';
import TmdbMovieRetriever from './informationRetrievers/TmdbMovieRetriever.js';
import logger from '../../../submodules/logger/index.js';
import { Movie } from '../../../models/movie.js';
import { MovieSet } from '../../../models/movieSet.js';

import type Oblecto from '../../oblecto/index.js';

type MovieSetInfo = {
    id: number;
    name: string;
};

type MovieUpdateData = Record<string, unknown> & {
    _set?: MovieSetInfo | null;
};

type UpdaterConstructor = new (oblecto: Oblecto) => {
    retrieveInformation: (entity: unknown) => Promise<Record<string, unknown>>;
};

export default class MovieUpdater {
    public oblecto: Oblecto;
    public aggregateMovieUpdateRetriever: AggregateUpdateRetriever;
    public availableUpdaters: string[];

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        this.aggregateMovieUpdateRetriever = new AggregateUpdateRetriever();

        const movieUpdateRetrievers: Record<string, UpdaterConstructor> = { 'tmdb': TmdbMovieRetriever };

        this.availableUpdaters = Object.keys(movieUpdateRetrievers);

        for (const updater of this.oblecto.config.movies.movieUpdaters) {
            logger.debug( `Loading ${updater} movie updater`);
            this.aggregateMovieUpdateRetriever.loadRetriever(new movieUpdateRetrievers[updater](this.oblecto));
        }

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('updateMovie', async (job: Movie) => {
            await this.updateMovie(job);
        });
    }

    /**
     * Fetch new movie metadata for a given movie entity
     * @param movie - Movie entity to be updated
     */
    async updateMovie(movie: Movie): Promise<void> {
        const data = await this.aggregateMovieUpdateRetriever.retrieveInformation(movie) as MovieUpdateData;

        if (data._set) {
            const setInfo = data._set;

            delete data._set;

            try {
                const [movieSet] = await MovieSet.findOrCreate({
                    where: { tmdbid: setInfo.id },
                    defaults: { setName: setInfo.name, }
                });

                // Update name if it changed
                if (movieSet.setName !== setInfo.name) {
                    await movieSet.update({ setName: setInfo.name });
                }

                await movieSet.addMovie(movie);
                logger.debug(`Added movie ${movie.id} to set ${movieSet.setName}`);
            } catch (e) {
                logger.error(`Failed to update movie set for movie ${movie.id}`, e);
            }
        }

        await movie.update(data);
    }
}
