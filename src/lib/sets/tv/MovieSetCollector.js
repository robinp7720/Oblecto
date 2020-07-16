import tmdb from '../../../submodules/tmdb';
import databases from '../../../submodules/database';

export default {
    GetTmdbLists: async function (movie) {
        let response = await tmdb.movieLists({id: movie.tmdbid});

    },

    /**
     * @return {boolean}
     */
    GetTmdbCollection: async function (movie) {
        let response = await tmdb.movieInfo({id: movie.tmdbid});

        if (!response.belongs_to_collection)
            return false;

        let collectionResponse = await tmdb.collectionInfo({id: response.belongs_to_collection.id});

        let [Collection, Inserted] = await databases.movieSet
            .findOrCreate({
                where: {tmdbid: collectionResponse.id}, defaults: {
                    setName: collectionResponse.name,
                    overview: collectionResponse.overview,
                }
            });

        Collection.addMovie(movie);

        return true;
    },

    GetSetsForMovie: function (movie) {
        this.GetTmdbLists(movie);
        this.GetTmdbCollection(movie);
    }
};