import { File } from '../../models/file.js';
import { Movie } from '../../models/movie.js';

import type Oblecto from '../oblecto/index.js';

type FederationMoviePayload = {
    host: string;
    id: string;
    duration?: number;
    fileInfo: {
        type: 'movie';
        tmdbid?: number;
    };
};

export default class FederationMovieIndexer {
    public oblecto: Oblecto;

    constructor(oblecto: Oblecto) {
        this.oblecto = oblecto;

        // Register task availability to Oblecto queue
        this.oblecto.queue.registerJob('federationIndexMovie', async (job: FederationMoviePayload) => {
            await this.indexMovie(job);
        });
    }

    async indexMovie(file: FederationMoviePayload): Promise<void> {
        const [fileEntity] = await File.findOrCreate({
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
         
        const [movie, movieInserted] = await Movie.findOrCreate({ where: { tmdbid: file.fileInfo.tmdbid } });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await movie.addFile(fileEntity);

        if (!movieInserted) return;

        await this.oblecto.movieUpdateCollector.collectMovie(movie);
        await this.oblecto.movieArtworkCollector.collectArtworkMovieFanart(movie);
        await this.oblecto.movieArtworkCollector.collectArtworkMoviePoster(movie);
    }
}
