import assert from 'node:assert/strict';
import TvdbEpisodeIdentifier from '../../src/lib/indexers/series/identifiers/TvdbEpisodeIdentifier.js';
import IdentificationError from '../../src/lib/errors/IdentificationError.js';
import type { TvdbEpisode } from '../../src/lib/common/tvdbTypes.js';
import type Oblecto from '../../src/lib/oblecto/index.js';

describe('TvdbEpisodeIdentifier', function () {
    const series = { tvdbid: 42, seriesName: 'Example' };
    const guess = { title: 'Example', type: 'episode' };

    function identifierWith(episodes: TvdbEpisode[]): TvdbEpisodeIdentifier {
        return new TvdbEpisodeIdentifier({
            tvdb: { getEpisodesBySeriesId: async () => episodes }
        } as unknown as Oblecto);
    }

    it('matches season and episode numbers even when an earlier episode has no name', async function () {
        const episodes = [
            { id: 1, airedSeason: 1, airedEpisodeNumber: 1 },
            { id: 2, airedSeason: 1, airedEpisodeNumber: 2 }
        ];

        assert.equal(await identifierWith(episodes).retrieveEpisode(series, {
            ...guess, season: 1, episode: 2
        }), episodes[1]);
    });

    it('does not match absent or blank names or incomplete numbering', async function () {
        const episodes = [
            { id: 1 },
            { id: 2, episodeName: '' },
            { id: 3, episodeName: '  ' },
            { id: 4, episodeName: 'Pilot', airedSeason: 1 },
            { id: 5, episodeName: 'Finale', airedEpisodeNumber: 2 }
        ];

        for (const fields of [{}, { episode_name: '' }, { episode_name: '  ' }, { season: 1 }, { episode: 2 }]) {
            await assert.rejects(
                identifierWith(episodes).retrieveEpisode(series, { ...guess, ...fields }),
                IdentificationError
            );
        }
    });

    it('matches a supplied episode name without season and episode numbers', async function () {
        const episodes = [{ id: 1, episodeName: 'Pilot' }, { id: 2, episodeName: 'Finale' }];

        assert.equal(await identifierWith(episodes).retrieveEpisode(series, {
            ...guess, episode_name: 'Finale'
        }), episodes[1]);
    });

    it('accepts zero-valued season and episode numbers', async function () {
        const episodes = [{ id: 1, airedSeason: 0, airedEpisodeNumber: 0 }];

        assert.equal(await identifierWith(episodes).retrieveEpisode(series, {
            ...guess, season: 0, episode: 0
        }), episodes[0]);
    });
});
