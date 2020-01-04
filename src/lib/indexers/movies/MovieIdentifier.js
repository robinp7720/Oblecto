import TmdbMovieIdentifier from './identifiers/TmdbMovieidentifier';

export default {
    movieIdentifiers: [
        new TmdbMovieIdentifier()
    ],

    async identifyMovie (moviePath) {
        let movieIdentification = {};

        for (let i in this.movieIdentifiers) {
            if (!this.movieIdentifiers.hasOwnProperty(i))
                continue;

            let movieIdentifier = this.movieIdentifiers[i];

            let currentIdentification = await movieIdentifier.identify(moviePath);

            Object.keys(currentIdentification).forEach((v, i) => {
                if (!movieIdentification[v]) {
                    movieIdentification[v] = currentIdentification[v];
                }
            });
        }

        return movieIdentification;
    }
};
