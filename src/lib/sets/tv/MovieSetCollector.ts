import tmdb from '../../../submodules/tmdb.js';
import databases from '../../../submodules/database.js';

import type { Movie } from '../../../models/movie.js';

export default {
    GetTmdbLists: async function (movie: Movie): Promise<void> {
        await tmdb.movieLists({ id: movie.tmdbid });
    },

    /**
     * @param movie
     * @returns
     */
    GetTmdbCollection: async function (movie: Movie): Promise<boolean> {
        const response = await tmdb.movieInfo({ id: movie.tmdbid });

        if (!response.belongs_to_collection)
            return false;

        const collectionResponse = await tmdb.collectionInfo({ id: response.belongs_to_collection.id });

        const [Collection] = await (databases as any).movieSet
            .findOrCreate({
                where: { tmdbid: collectionResponse.id },
                defaults: {
                    setName: collectionResponse.name,
                    overview: collectionResponse.overview,
                }
            });

        Collection.addMovie(movie);

        return true;
    },

    GetSetsForMovie: function (movie: Movie): void {
        void this.GetTmdbLists(movie);
        void this.GetTmdbCollection(movie);
    }
};
