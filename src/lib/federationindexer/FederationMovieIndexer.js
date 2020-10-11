import {File} from '../../models/file';
import {Movie} from '../../models/movie';

export default class FederationMovieIndexer {
    constructor(oblecto) {
        this.oblecto = oblecto;

        // Register task availability to Oblecto queue
        this.oblecto.queue.addJob('federationIndexMovie', async (job) => {
            await this.indexMovie(job);
        });
    }

    async indexMovie(file) {
        let [fileEntity, fileInserted] = await File.findOrCreate({
            where: {
                host: file.host,
                path: file.id
            },
            defaults: {
                name: '',
                directory: '',
                extension: '',
                duration: file.duration
            }
        });

        let [movie, movieInserted] = await Movie.findOrCreate({
            where: {
                tmdbid: file.fileInfo.tmdbid
            }
        });

        await movie.addFile(fileEntity);

        if (!movieInserted) return;

        await this.oblecto.movieUpdateCollector.collectMovie(movie);
        await this.oblecto.movieArtworkCollector.collectArtworkMovieFanart(movie);
        await this.oblecto.movieArtworkCollector.collectArtworkMoviePoster(movie);

    }
}
