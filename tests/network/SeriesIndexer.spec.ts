/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import assert from 'node:assert/strict';

import Queue from '../../src/lib/queue/index.js';
import SeriesIndexer from '../../src/lib/indexers/series/SeriesIndexer.js';
import guessit from '../../src/submodules/guessit.js';
import { createTvdbClient } from '../../src/lib/common/TvdbAdapter.js';
import config from '../../src/config.js';
import { MovieDb } from 'moviedb-promise';
import { TMDB_KEY, TVDB_KEY } from './keys.js';

// Uses the project keys from res/config.json unless OBLECTO_TVDB_KEY or OBLECTO_TMDB_KEY is set.
const tvdbKey = TVDB_KEY;
const tmdbKey = TMDB_KEY;

function createOblectoFixture() {
    return {
        tvdb: createTvdbClient(tvdbKey),
        tmdb: new MovieDb(tmdbKey),

        queue: new Queue(1),
        fileIndexer: { indexVideoFile: async () => { throw new Error('This fixture only identifies media'); } },
        config: {
            tvshows: {
                ...config.tvshows,
                seriesIdentifiers: ['tmdb', 'tvdb'],
                episodeIdentifiers: ['tmdb', 'tvdb']
            }
        }
    };
}

describe('SeriesIndexer', function () {
    describe('Aggregate Series Identifier', function () {
        this.timeout(100000);
        it('/mnt/SMB/TV Shows/stargirl.s02e03.1080p.web.h264-cakes.mkv', async function () {
            const oblecto = createOblectoFixture();
            const seriesIndexer = new SeriesIndexer(oblecto);
            const identification = await seriesIndexer.seriesIdentifier.identify('/mnt/SMB/TV Shows/stargirl.s02e03.1080p.web.h264-cakes.mkv', await guessit.identify('/mnt/SMB/TV Shows/stargirl.s02e03.1080p.web.h264-cakes.mkv'));

            assert.equal(identification.tmdbid, 80986);
            assert.equal(identification.seriesName, 'Stargirl');
            assert.equal(identification.tvdbid, 361868);
        });

        it('/mnt/SMB/TV Shows/The Flash (2014)/The Flash (2014) S5E8.mp4', async function () {
            const oblecto = createOblectoFixture();
            const seriesIndexer = new SeriesIndexer(oblecto);
            const identification = await seriesIndexer.seriesIdentifier.identify('/mnt/SMB/TV Shows/The Flash (2014)/The Flash (2014) S5E8.mp4', await guessit.identify('/mnt/SMB/TV Shows/The Flash (2014)/The Flash (2014) S5E8.mp4'));

            assert.equal(identification.tmdbid, 60735);
            assert.equal(identification.seriesName, 'The Flash (2014)');
            assert.equal(identification.tvdbid, 279121);
        });

        it('/mnt/Media/Series/Catch-22/Catch-22.S01E06.2160p.HULU.WEB-DL.DDP5.1.DV.H.265-NTb.mkv', async function () {
            const oblecto = createOblectoFixture();
            const seriesIndexer = new SeriesIndexer(oblecto);
            await seriesIndexer.seriesIdentifier.identify('/mnt/Media/Series/Catch-22/Catch-22.S01E06.2160p.HULU.WEB-DL.DDP5.1.DV.H.265-NTb.mkv', await guessit.identify('/mnt/Media/Series/Catch-22/Catch-22.S01E06.2160p.HULU.WEB-DL.DDP5.1.DV.H.265-NTb.mkv'));
        });
    });

    describe('Aggregate Episode Identifier', function () {
        this.timeout(100000);
        it('/mnt/SMB/TV Shows/stargirl.s02e03.1080p.web.h264-cakes.mkv', async function () {
            const oblecto = createOblectoFixture();
            const seriesIndexer = new SeriesIndexer(oblecto);
            const path = '/mnt/smb/tv shows/stargirl.s02e03.1080p.web.h264-cakes.mkv';
            const guessitIdentification = await guessit.identify(path);

            const seriesIdentification = await seriesIndexer.seriesIdentifier.identify(path, guessitIdentification);
            const identification = await seriesIndexer.episodeIdentifer.identify(path, guessitIdentification, seriesIdentification);

            assert.equal(identification.tmdbid, 3099451);
            assert.equal(identification.airedEpisodeNumber, 3);
            assert.equal(identification.airedSeason, 2);
            assert.equal(identification.tvdbid, 8409199);
            assert.equal(identification.imdbid, 'tt14581818');
        });

        it('/mnt/SMB/TV Shows/The Flash (2014)/The Flash (2014) S5E8.mp4', async function () {
            const oblecto = createOblectoFixture();
            const seriesIndexer = new SeriesIndexer(oblecto);
            const path = '/mnt/SMB/TV Shows/The Flash (2014)/The Flash (2014) S5E8.mp4';
            const guessitIdentification = await guessit.identify(path);

            const seriesIdentification = await seriesIndexer.seriesIdentifier.identify(path, guessitIdentification);
            const identification = await seriesIndexer.episodeIdentifer.identify(path, guessitIdentification, seriesIdentification);

            assert.equal(identification.tmdbid, 1620866);
            assert.equal(identification.airedEpisodeNumber, 8);
            assert.equal(identification.airedSeason, 5);
            assert.equal(identification.tvdbid, 6885898);
            assert.equal(identification.imdbid, 'tt8312898');
        });
        it('/mnt/Media/Series/Catch-22/Catch-22.S01E06.2160p.HULU.WEB-DL.DDP5.1.DV.H.265-NTb.mkv', async function () {
            const oblecto = createOblectoFixture();
            const seriesIndexer = new SeriesIndexer(oblecto);
            const path = '/mnt/Media/Series/Catch-22/Catch-22.S01E06.2160p.HULU.WEB-DL.DDP5.1.DV.H.265-NTb.mkv';

            const identification = await seriesIndexer.identify(path);

            assert.equal(identification.series.tmdbid, 82744);
            assert.equal(identification.series.seriesName, 'Catch-22');
            assert.equal(identification.series.tvdbid, 357558);
            assert.equal(identification.episode.tmdbid, 1664030);
            assert.equal(identification.episode.airedEpisodeNumber, 6);
            assert.equal(identification.episode.airedSeason, 1);
            assert.equal(identification.episode.tvdbid, 6972688);
        });
    });

});
