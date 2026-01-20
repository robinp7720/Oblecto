/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-plus-operands, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-misused-promises */
import expect from 'expect.js';

import Queue from '../../src/lib/queue/index.js';
import SeriesIndexer from '../../src/lib/indexers/series/SeriesIndexer.js';
import guessit from '../../src/submodules/guessit.js';
import TVDB from 'node-tvdb';
import { MovieDb } from 'moviedb-promise';

const oblecto = {
    tvdb: new TVDB( '4908EBCEE2556E3D'),
    tmdb: new MovieDb('b06b4917705eeed4e4b273d4c90fe158'),

    queue: new Queue(1),
    config: {
        tvshows: {
            seriesIdentifiers: ['tmdb', 'tvdb'],
            episodeIdentifiers: ['tmdb', 'tvdb']
        }
    }
};

describe('SeriesIndexer', function () {
    describe('Aggregate Series Identifier', async function () {
        this.timeout(100000);
        it('/mnt/SMB/TV Shows/stargirl.s02e03.1080p.web.h264-cakes.mkv', async function () {
            const seriesIndexer = new SeriesIndexer(oblecto);
            const identification = await seriesIndexer.seriesIdentifier.identify('/mnt/SMB/TV Shows/stargirl.s02e03.1080p.web.h264-cakes.mkv', await guessit.identify('/mnt/SMB/TV Shows/stargirl.s02e03.1080p.web.h264-cakes.mkv'));

            console.log(identification);

            expect(identification.tmdbid).to.be(80986);
            expect(identification.seriesName).to.be('Stargirl');
            expect(identification.tvdbid).to.be(361868);
        });

        it('/mnt/SMB/TV Shows/The Flash (2014)/The Flash (2014) S5E8.mp4', async function () {
            const seriesIndexer = new SeriesIndexer(oblecto);
            const identification = await seriesIndexer.seriesIdentifier.identify('/mnt/SMB/TV Shows/The Flash (2014)/The Flash (2014) S5E8.mp4', await guessit.identify('/mnt/SMB/TV Shows/The Flash (2014)/The Flash (2014) S5E8.mp4'));

            console.log(identification);

            expect(identification.tmdbid).to.be(60735);
            expect(identification.seriesName).to.be('The Flash (2014)');
            expect(identification.tvdbid).to.be(279121);
        });

        it('/mnt/Media/Series/Catch-22/Catch-22.S01E06.2160p.HULU.WEB-DL.DDP5.1.DV.H.265-NTb.mkv', async function () {
            const seriesIndexer = new SeriesIndexer(oblecto);
            const identification = await seriesIndexer.seriesIdentifier.identify('/mnt/Media/Series/Catch-22/Catch-22.S01E06.2160p.HULU.WEB-DL.DDP5.1.DV.H.265-NTb.mkv', await guessit.identify('/mnt/Media/Series/Catch-22/Catch-22.S01E06.2160p.HULU.WEB-DL.DDP5.1.DV.H.265-NTb.mkv'));

            console.log(identification);
        });
    });

    describe('Aggregate Episode Identifier', async function () {
        this.timeout(100000);
        it('/mnt/SMB/TV Shows/stargirl.s02e03.1080p.web.h264-cakes.mkv', async function () {
            const seriesIndexer = new SeriesIndexer(oblecto);
            const path = '/mnt/smb/tv shows/stargirl.s02e03.1080p.web.h264-cakes.mkv';
            const guessitIdentification = await guessit.identify(path);

            const seriesIdentification = await seriesIndexer.seriesIdentifier.identify(path, guessitIdentification);
            const identification = await seriesIndexer.episodeIdentifer.identify(path, guessitIdentification, seriesIdentification);

            console.log(identification);

            expect(identification.tmdbid).to.be(3099451);
            expect(identification.airedEpisodeNumber).to.be(3);
            expect(identification.airedSeason).to.be(2);
            expect(identification.tvdbid).to.be(8409199);
            expect(identification.imdbid).to.be('tt14581818');
        });

        it('/mnt/SMB/TV Shows/The Flash (2014)/The Flash (2014) S5E8.mp4', async function () {
            const seriesIndexer = new SeriesIndexer(oblecto);
            const path = '/mnt/SMB/TV Shows/The Flash (2014)/The Flash (2014) S5E8.mp4';
            const guessitIdentification = await guessit.identify(path);

            const seriesIdentification = await seriesIndexer.seriesIdentifier.identify(path, guessitIdentification);
            const identification = await seriesIndexer.episodeIdentifer.identify(path, guessitIdentification, seriesIdentification);

            console.log(identification);

            expect(identification.tmdbid).to.be(1620866);
            expect(identification.airedEpisodeNumber).to.be(8);
            expect(identification.airedSeason).to.be(5);
            expect(identification.tvdbid).to.be(6885898);
            expect(identification.imdbid).to.be('tt8312898');
        });
        it('/mnt/Media/Series/Catch-22/Catch-22.S01E06.2160p.HULU.WEB-DL.DDP5.1.DV.H.265-NTb.mkv', async function () {
            const seriesIndexer = new SeriesIndexer(oblecto);
            const path = '/mnt/Media/Series/Catch-22/Catch-22.S01E06.2160p.HULU.WEB-DL.DDP5.1.DV.H.265-NTb.mkv';

            const identification = await seriesIndexer.identify(path);

            console.log(identification);

        });
    });

});
