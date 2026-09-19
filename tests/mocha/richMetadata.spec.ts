import assert from 'node:assert/strict';
import TmdbMovieRetriever from '../../src/lib/updaters/movies/informationRetrievers/TmdbMovieRetriever.js';
import TmdbSeriesRetriever from '../../src/lib/updaters/series/informationRetrievers/TmdbSeriesRetriever.js';
import TmdbEpisodeRetriever from '../../src/lib/updaters/series/informationRetrievers/TmdbEpisodeRetriever.js';
import { decodeCursor, encodeCursor, parseBrowseParams } from '../../src/submodules/REST/routes/helpers/browse.js';

describe('Rich media metadata', () => {
    it('maps movie scores, cast and key crew from TMDB', async () => {
        const oblecto = {
            tmdb: {
                movieInfo: async () => ({ title: 'Arrival', genres: [], vote_average: 8.1, vote_count: 17000 }),
                movieCredits: async () => ({
                    cast: [{ id: 1, name: 'Amy Adams', character: 'Louise Banks', order: 0, profile_path: '/amy.jpg' }],
                    crew: [{ id: 2, name: 'Denis Villeneuve', job: 'Director', department: 'Directing' }]
                })
            }
        };
        const data = await new TmdbMovieRetriever(oblecto as never).retrieveInformation({ tmdbid: 329865 } as never);
        const credits = data._credits as Array<Record<string, unknown>>;

        assert.equal(data.siteRating, 8.1);
        assert.equal(data.siteRatingCount, 17000);
        assert.deepEqual(credits.map(credit => [credit.name, credit.character ?? credit.job]), [
            ['Amy Adams', 'Louise Banks'],
            ['Denis Villeneuve', 'Director']
        ]);
    });

    it('maps aggregate series roles and creators', async () => {
        const oblecto = {
            tmdb: {
                tvInfo: async () => ({
                    name: 'Show', genres: [], created_by: [{ id: 7, name: 'Creator' }],
                    episode_run_time: [52], networks: [{ name: 'Network' }]
                }),
                tvAggregateCredits: async () => ({
                    cast: [{ id: 3, name: 'Actor', roles: [{ character: 'Lead', episode_count: 8 }], order: 0 }],
                    crew: []
                }),
                tvExternalIds: async () => ({})
            }
        };
        const data = await new TmdbSeriesRetriever(oblecto as never).retrieveInformation({ tmdbid: 4, tvdbid: 5, imdbid: 'tt1' } as never);
        const credits = data._credits as Array<Record<string, unknown>>;

        assert.equal(data.runtime, 52);
        assert.equal(data.network, 'Network');
        assert.equal(credits.find(credit => credit.character === 'Lead')?.episodeCount, 8);
        assert.equal(credits.find(credit => credit.job === 'Creator')?.name, 'Creator');
    });

    it('maps episode runtime, score and guest stars', async () => {
        const oblecto = {
            tmdb: {
                episodeInfo: async () => ({
                    name: 'Episode', episode_number: 2, season_number: 1, runtime: 48,
                    vote_average: 7.4, vote_count: 210,
                    guest_stars: [{ id: 9, name: 'Guest', character: 'Visitor', order: 0 }],
                    crew: []
                }),
                episodeExternalIds: async () => ({})
            }
        };
        const episode = { tmdbid: 10, tvdbid: 11, imdbid: 'tt2', airedSeason: '1', airedEpisodeNumber: '2', getSeries: async () => ({ tmdbid: 4 }) };
        const data = await new TmdbEpisodeRetriever(oblecto as never).retrieveInformation(episode as never);

        assert.equal(data.runtime, 48);
        assert.equal(data.siteRating, 7.4);
        assert.equal((data._credits as Array<Record<string, unknown>>)[0].character, 'Visitor');
    });

    it('binds cursors to person and role filters', () => {
        const cast = parseBrowseParams({ mode: 'browse', personId: '12', creditRole: 'cast' });
        const director = parseBrowseParams({ mode: 'browse', personId: '12', creditRole: 'director' });
        const cursor = encodeCursor('movieName', 'asc', 'A', 1, cast.filterHash);

        assert.equal(cast.personId, 12);
        assert.equal(cast.creditRole, 'cast');
        assert.notEqual(cast.filterHash, director.filterHash);
        assert.throws(() => decodeCursor(cursor, 'movieName', 'asc', director.filterHash), /current query/);
        assert.throws(() => parseBrowseParams({ mode: 'browse', personId: '-1' }), /personId/);
    });
});
