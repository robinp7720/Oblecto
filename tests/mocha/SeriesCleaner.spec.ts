
import expect from 'expect.js';
import { Episode } from '../../src/models/episode.js';
import { Series } from '../../src/models/series.js';
import SeriesCleaner from '../../src/lib/cleaners/SeriesCleaner.js';
import logger from '../../src/submodules/logger/index.js';
import Queue from '../../src/lib/queue/index.js';

describe('SeriesCleaner', function () {
    let seriesCleaner: SeriesCleaner;
    let originalEpisodeFindAll: any;
    let originalSeriesFindAll: any;
    let originalSeriesDestroy: any;

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
        seriesCleaner = new SeriesCleaner(mockOblecto);
        originalEpisodeFindAll = Episode.findAll;
        originalSeriesFindAll = Series.findAll;
        originalSeriesDestroy = Series.destroy;
    });

    afterEach(function () {
        // @ts-ignore
        Episode.findAll = originalEpisodeFindAll;
        // @ts-ignore
        Series.findAll = originalSeriesFindAll;
        // @ts-ignore
        Series.destroy = originalSeriesDestroy;
    });

    describe('removeFileLessEpisodes', function () {
        it('should remove episodes without linked files', async function () {
            const destroyedIds: number[] = [];
            
            const mockEpisodes = [
                {
                    id: 1,
                    episodeName: 'Episode With File',
                    Files: [{ id: 100 }], // Has file
                    destroy: async () => { destroyedIds.push(1); }
                },
                {
                    id: 2,
                    episodeName: 'Episode Without File',
                    Files: [], // No file
                    destroy: async () => { destroyedIds.push(2); }
                }
            ];

            // Mock Episode.findAll
            // @ts-ignore
            Episode.findAll = async () => mockEpisodes;

            await seriesCleaner.removeFileLessEpisodes();

            expect(destroyedIds).to.contain(2);
            expect(destroyedIds).to.not.contain(1);
            expect(destroyedIds.length).to.be(1);
        });
    });

    describe('removePathLessShows', function () {
        it('should remove series without a path', async function () {
            let destroyQuery: any = null;

            // Mock Series.destroy
            // @ts-ignore
            Series.destroy = async (query: any) => {
                destroyQuery = query;
            };

            await seriesCleaner.removePathLessShows();

            expect(destroyQuery).to.eql({ where: { directory: '' } });
        });
    });

    describe('removeEpisodeslessShows', function () {
        it('should remove series without attached episodes', async function () {
            const destroyedIds: number[] = [];
            
            const mockSeries = [
                {
                    id: 1,
                    seriesName: 'Series With Episode',
                    Episodes: [{ id: 100 }], // Has episode
                    destroy: async () => { destroyedIds.push(1); }
                },
                {
                    id: 2,
                    seriesName: 'Series Without Episode',
                    Episodes: [], // No episode
                    destroy: async () => { destroyedIds.push(2); }
                }
            ];

            // Mock Series.findAll
            // @ts-ignore
            Series.findAll = async () => mockSeries;

            await seriesCleaner.removeEpisodeslessShows();

            expect(destroyedIds).to.contain(2);
            expect(destroyedIds).to.not.contain(1);
            expect(destroyedIds.length).to.be(1);
        });
    });
});
