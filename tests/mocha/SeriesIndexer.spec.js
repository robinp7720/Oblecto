'strict';
const expect = require('expect.js');

const { default: Queue } = require('../../dist/lib/queue');
const { default: SeriesIndexer } = require('../../dist/lib/indexers/series/SeriesIndexer');
const { default: guessit } = require('../../dist/submodules/guessit');
const TVDB = require('node-tvdb');
const { MovieDb } = require('moviedb-promise');

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
    });
});
