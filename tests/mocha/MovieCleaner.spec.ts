
import assert from 'node:assert/strict';
import { Movie } from '../../src/models/movie.js';
import MovieCleaner from '../../src/lib/cleaners/MovieCleaner.js';
import logger from '../../src/submodules/logger/index.js';

describe('MovieCleaner', function () {
    let movieCleaner: MovieCleaner;
    let originalFindAll: any;

    before(function () {
        logger.silent = true;
    });

    after(function () {
        logger.silent = false;
    });

    beforeEach(function () {
        movieCleaner = new MovieCleaner();
        originalFindAll = Movie.findAll;
    });

    afterEach(function () {
        // @ts-ignore
        Movie.findAll = originalFindAll;
    });

    describe('removeFileLessMovies', function () {
        it('should remove movies without linked files', async function () {
            const destroyedIds: number[] = [];

            const mockMovies = [
                {
                    id: 1,
                    movieName: 'Movie With File',
                    Files: [{ id: 100 }], // Has file
                    destroy: async () => { destroyedIds.push(1); }
                },
                {
                    id: 2,
                    movieName: 'Movie Without File',
                    Files: [], // No file
                    destroy: async () => { destroyedIds.push(2); }
                }
            ];

            // Mock Movie.findAll
            // @ts-ignore
            Movie.findAll = async () => mockMovies;

            await movieCleaner.removeFileLessMovies();

            assert.ok(destroyedIds?.includes(2));
            assert.ok(!destroyedIds.includes(1));
            assert.equal(destroyedIds.length, 1);
        });
    });
});
