import assert from 'node:assert/strict';
import TmdbMovieIdentifier from '../../src/lib/indexers/movies/identifiers/TmdbMovieidentifier.js';
import TmdbSeriesIdentifier from '../../src/lib/indexers/series/identifiers/TmdbSeriesIdentifier.js';
import TvdbSeriesIdentifier from '../../src/lib/indexers/series/identifiers/TvdbSeriesIdentifier.js';
import TmdbEpisodeIdentifier from '../../src/lib/indexers/series/identifiers/TmdbEpisodeIdentifier.js';
import TvdbEpisodeIdentifier from '../../src/lib/indexers/series/identifiers/TvdbEpisodeIdentifier.js';
import IdentificationError from '../../src/lib/errors/IdentificationError.js';
import type Oblecto from '../../src/lib/oblecto/index.js';

const makeOblecto = (overrides: Record<string, any> = {}) => ({ ...overrides }) as unknown as Oblecto;

describe('TmdbMovieIdentifier', () => {
    it('resolves the first TMDB search result', async () => {
        const oblecto = makeOblecto({
            tmdb: {
                searchMovie: async () => ({ results: [{ id: 100, title: 'Catch-22', overview: 'A war satire' }] })
            }
        });
        const identifier = new TmdbMovieIdentifier(oblecto);

        const result = await identifier.identify('/x/Catch-22.mkv', { title: 'Catch-22', type: 'movie' } as any);

        assert.deepEqual(result, { tmdbid: 100, movieName: 'Catch-22', overview: 'A war satire' });
    });

    it('includes primary_release_year in the query when a year is available', async () => {
        let receivedQuery: any;
        const oblecto = makeOblecto({
            tmdb: {
                searchMovie: async (query: any) => {
                    receivedQuery = query;
                    return { results: [{ id: 1, title: 'X' }] };
                }
            }
        });
        const identifier = new TmdbMovieIdentifier(oblecto);

        await identifier.identify('/x.mkv', { title: 'X', year: 2019, type: 'movie' } as any);

        assert.equal(receivedQuery.query, 'X');
        assert.equal(receivedQuery.primary_release_year, 2019);
    });

    it('throws IdentificationError when TMDB returns no results', async () => {
        const oblecto = makeOblecto({ tmdb: { searchMovie: async () => ({ results: [] }) } });
        const identifier = new TmdbMovieIdentifier(oblecto);

        await assert.rejects(
            () => identifier.identify('/x.mkv', { title: 'Unknown Movie', type: 'movie' } as any),
            IdentificationError
        );
    });
});

describe('TmdbSeriesIdentifier', () => {
    it('resolves the only search result when no year disambiguation is needed', async () => {
        const oblecto = makeOblecto({
            tmdb: { searchTv: async () => ({ results: [{ id: 5, name: 'Stargirl', overview: 'Hero show' }] }) }
        });
        const identifier = new TmdbSeriesIdentifier(oblecto);

        const result = await identifier.identify('/x.mkv', { title: 'Stargirl', type: 'episode' } as any);

        assert.deepEqual(result, { tmdbid: 5, seriesName: 'Stargirl', overview: 'Hero show' });
    });

    it('disambiguates multiple results using first_air_date year', async () => {
        const oblecto = makeOblecto({
            tmdb: {
                searchTv: async () => ({
                    results: [
                        { id: 1, name: 'The Flash', overview: 'old', first_air_date: '1990-01-01' },
                        { id: 2, name: 'The Flash (2014)', overview: 'new', first_air_date: '2014-10-07' }
                    ]
                })
            }
        });
        const identifier = new TmdbSeriesIdentifier(oblecto);

        const result = await identifier.identify('/x.mkv', { title: 'The Flash', year: 2014, type: 'episode' } as any);

        assert.equal(result.tmdbid, 2);
        assert.equal(result.seriesName, 'The Flash (2014)');
    });

    it('caches results for repeated title+year lookups', async () => {
        let callCount = 0;
        const oblecto = makeOblecto({
            tmdb: {
                searchTv: async () => {
                    callCount++;
                    return { results: [{ id: 9, name: 'Cached Show', overview: '' }] };
                }
            }
        });
        const identifier = new TmdbSeriesIdentifier(oblecto);

        await identifier.identify('/x.mkv', { title: 'Cached Show', type: 'episode' } as any);
        await identifier.identify('/x.mkv', { title: 'Cached Show', type: 'episode' } as any);

        assert.equal(callCount, 1);
    });

    it('throws IdentificationError when search returns no results', async () => {
        const oblecto = makeOblecto({ tmdb: { searchTv: async () => ({ results: [] }) } });
        const identifier = new TmdbSeriesIdentifier(oblecto);

        await assert.rejects(
            () => identifier.identify('/x.mkv', { title: 'Nothing', type: 'episode' } as any),
            IdentificationError
        );
    });

    it('throws IdentificationError when no year in results matches (multiple candidates)', async () => {
        const oblecto = makeOblecto({
            tmdb: {
                searchTv: async () => ({
                    results: [
                        { id: 1, name: 'X', overview: '', first_air_date: '1990-01-01' },
                        { id: 2, name: 'X', overview: '', first_air_date: '1995-01-01' }
                    ]
                })
            }
        });
        const identifier = new TmdbSeriesIdentifier(oblecto);

        await assert.rejects(
            () => identifier.identify('/x.mkv', { title: 'X', year: 2020, type: 'episode' } as any),
            IdentificationError
        );
    });

    it('ignores year mismatch when TMDB returns exactly one candidate', async () => {
        const oblecto = makeOblecto({
            tmdb: { searchTv: async () => ({ results: [{ id: 1, name: 'X', overview: '', first_air_date: '1990-01-01' }] }) }
        });
        const identifier = new TmdbSeriesIdentifier(oblecto);

        const result = await identifier.identify('/x.mkv', { title: 'X', year: 2020, type: 'episode' } as any);

        assert.equal(result.tmdbid, 1);
    });
});

describe('TvdbSeriesIdentifier', () => {
    it('finds the closest name match by levenshtein distance', async () => {
        const oblecto = makeOblecto({
            tvdb: {
                getSeriesByName: async () => ([
                    { id: 1, seriesName: 'Doctor Who Confidential' },
                    { id: 2, seriesName: 'Doctor Who' }
                ])
            }
        });
        const identifier = new TvdbSeriesIdentifier(oblecto);

        const result = await identifier.identify('/x.mkv', { title: 'Doctor Who', type: 'episode' } as any);

        assert.equal(result.tvdbid, 2);
        assert.equal(result.seriesName, 'Doctor Who');
    });

    it('filters candidates by first-aired year when a year is present', async () => {
        const oblecto = makeOblecto({
            tvdb: {
                getSeriesByName: async () => ([
                    { id: 1, seriesName: 'The Flash', firstAired: '1990-01-01' },
                    { id: 2, seriesName: 'The Flash', firstAired: '2014-10-07' }
                ])
            }
        });
        const identifier = new TvdbSeriesIdentifier(oblecto);

        const result = await identifier.identify('/x.mkv', { title: 'The Flash', year: 2014, type: 'episode' } as any);

        assert.equal(result.tvdbid, 2);
    });

    it('throws IdentificationError when no candidate matches the given year', async () => {
        const oblecto = makeOblecto({
            tvdb: { getSeriesByName: async () => ([{ id: 1, seriesName: 'X', firstAired: '1990-01-01' }]) }
        });
        const identifier = new TvdbSeriesIdentifier(oblecto);

        await assert.rejects(
            () => identifier.identify('/x.mkv', { title: 'X', year: 2020, type: 'episode' } as any),
            IdentificationError
        );
    });

    it('caches results for repeated lookups', async () => {
        let callCount = 0;
        const oblecto = makeOblecto({
            tvdb: {
                getSeriesByName: async () => {
                    callCount++;
                    return [{ id: 3, seriesName: 'Cached' }];
                }
            }
        });
        const identifier = new TvdbSeriesIdentifier(oblecto);

        await identifier.identify('/x.mkv', { title: 'Cached', type: 'episode' } as any);
        await identifier.identify('/x.mkv', { title: 'Cached', type: 'episode' } as any);

        assert.equal(callCount, 1);
    });
});

describe('TmdbEpisodeIdentifier', () => {
    it('resolves episode info using the series tmdbid', async () => {
        let receivedArgs: any;
        const oblecto = makeOblecto({
            tmdb: {
                episodeInfo: async (args: any) => {
                    receivedArgs = args;
                    return { id: 55, name: 'Pilot', episode_number: 1, season_number: 1, overview: 'x', air_date: '2020-01-01' };
                }
            }
        });
        const identifier = new TmdbEpisodeIdentifier(oblecto);

        const result = await identifier.identify('/x.mkv', { season: 1, episode: 1 } as any, { tmdbid: 80986 });

        assert.equal(receivedArgs.id, 80986);
        assert.equal(receivedArgs.season_number, 1);
        assert.equal(receivedArgs.episode_number, 1);
        assert.deepEqual(result, {
            tmdbid: 55,
            episodeName: 'Pilot',
            airedEpisodeNumber: 1,
            airedSeason: 1,
            overview: 'x',
            firstAired: '2020-01-01'
        });
    });

    it('defaults season to 1 when not present in guessit data', async () => {
        let receivedArgs: any;
        const oblecto = makeOblecto({
            tmdb: {
                episodeInfo: async (args: any) => {
                    receivedArgs = args;
                    return { id: 1, name: 'X', episode_number: 3, season_number: 1 };
                }
            }
        });
        const identifier = new TmdbEpisodeIdentifier(oblecto);

        await identifier.identify('/x.mkv', { episode: 3 } as any, { tmdbid: 1 });

        assert.equal(receivedArgs.season_number, 1);
    });

    it('throws IdentificationError when the series has no tmdbid', async () => {
        const identifier = new TmdbEpisodeIdentifier(makeOblecto({ tmdb: {} }));

        await assert.rejects(
            () => identifier.identify('/x.mkv', { season: 1, episode: 1 } as any, {}),
            IdentificationError
        );
    });
});

describe('TvdbEpisodeIdentifier', () => {
    const episodes = [
        { id: 1, episodeName: 'Pilot', airedSeason: 1, airedEpisodeNumber: 1, imdbId: 'tt1' },
        { id: 2, episodeName: 'Episode Two', airedSeason: 1, airedEpisodeNumber: 2, imdbId: 'tt2' }
    ];

    it('matches an episode by season/episode number', async () => {
        const oblecto = makeOblecto({ tvdb: { getEpisodesBySeriesId: async () => episodes } });
        const identifier = new TvdbEpisodeIdentifier(oblecto);

        const result = await identifier.identify('/x.mkv', { season: 1, episode: 2 } as any, { tvdbid: 361868, seriesName: 'Stargirl' });

        assert.equal(result.tvdbid, 2);
        assert.equal(result.episodeName, 'Episode Two');
        assert.equal(result.imdbid, 'tt2');
    });

    it('matches an episode by episode_name before falling back to season/episode', async () => {
        const oblecto = makeOblecto({ tvdb: { getEpisodesBySeriesId: async () => episodes } });
        const identifier = new TvdbEpisodeIdentifier(oblecto);

        const result = await identifier.identify('/x.mkv', { episode_name: 'Pilot' } as any, { tvdbid: 1, seriesName: 'X' });

        assert.equal(result.tvdbid, 1);
    });

    it('caches episode lookups per series id', async () => {
        let callCount = 0;
        const oblecto = makeOblecto({
            tvdb: {
                getEpisodesBySeriesId: async () => {
                    callCount++;
                    return episodes;
                }
            }
        });
        const identifier = new TvdbEpisodeIdentifier(oblecto);

        await identifier.identify('/x.mkv', { season: 1, episode: 1 } as any, { tvdbid: 5, seriesName: 'X' });
        await identifier.identify('/x.mkv', { season: 1, episode: 2 } as any, { tvdbid: 5, seriesName: 'X' });

        assert.equal(callCount, 1);
    });

    it('throws IdentificationError when series has no tvdbid', async () => {
        const identifier = new TvdbEpisodeIdentifier(makeOblecto({ tvdb: {} }));

        await assert.rejects(
            () => identifier.identify('/x.mkv', { season: 1, episode: 1 } as any, {}),
            IdentificationError
        );
    });

    it('throws IdentificationError when no episode matches', async () => {
        const oblecto = makeOblecto({ tvdb: { getEpisodesBySeriesId: async () => episodes } });
        const identifier = new TvdbEpisodeIdentifier(oblecto);

        await assert.rejects(
            () => identifier.identify('/x.mkv', { season: 9, episode: 9 } as any, { tvdbid: 5, seriesName: 'X' }),
            IdentificationError
        );
    });
});
