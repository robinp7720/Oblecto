
import expect from 'expect.js';
import { Movie } from '../../src/models/movie.js';
import MovieCleaner from '../../src/lib/cleaners/MovieCleaner.js';
import logger from '../../src/submodules/logger/index.js';
import Queue from '../../src/lib/queue/index.js';

describe('MovieCleaner', function () {
    let movieCleaner: MovieCleaner;
    let originalFindAll: any;

    const mockOblecto: any = {
        queue: new Queue(1)
    };

    before(function () {
        logger.silent = true;
    });

    after(function () {
        logger.silent = false;
    });

    beforeEach(function () {
        movieCleaner = new MovieCleaner(mockOblecto);
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

            expect(destroyedIds).to.contain(2);
            expect(destroyedIds).to.not.contain(1);
            expect(destroyedIds.length).to.be(1);
        });
    });
});
