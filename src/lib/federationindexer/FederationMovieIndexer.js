import databases from '../../submodules/database';

export default class FederationMovieIndexer {
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async indexMovie(file) {
        let [fileEntity, fileInserted] = await databases.file.findOrCreate({
            where: {
                host: this.host,
                path: file.id
            },
            defaults: {
                name: '',
                directory: '',
                extension: '',
                duration: file.duration
            }
        });

        let [movie, movieInserted] = await databases.movie.findOrCreate({
            where: {
                tmdbid: file.fileInfo.tmdbid
            }
        });

        await this.oblecto.movieUpdateCollector.collectMovie(movie);
        await this.oblecto.movieArtworkCollector.collectArtworkMovieFanart(movie);
        await this.oblecto.movieArtworkCollector.collectArtworkMoviePoster(movie);

        await movie.addFile(fileEntity);
    }
}
