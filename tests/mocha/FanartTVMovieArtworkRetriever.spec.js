require('chai/register-should');  // Using Should style

const { default: FanarttvMovieArtworkRetriever } = require('../../dist/lib/artwork/movies/artworkRetrievers/FanarttvMovieArtworkRetriever');
const { default: Queue } = require('../../dist/lib/queue');

const TMDBID_TEST_ID = '299534';
const IMDBD_TEST_ID = 'tt4154796';

const oblecto = {
    queue: new Queue(1),
    config: {
        'fanart.tv': {
            key: 'b6821e30b1a791e04d43543936de1fd0'
        }
    }
};

describe('FanartTV Movie Artwork Retriever', function () {
    const ArtworkRetriever = new FanarttvMovieArtworkRetriever(oblecto);

    it('Fanart artwork retrieval using TMDBID', async function () {
        const images = await ArtworkRetriever.retrieveFanart({
            tmdbid: TMDBID_TEST_ID
        });

        images.should.have.length.above(1);
    });

    it('Fanart artwork retrieval using IMDBID', async function () {
        const images = await ArtworkRetriever.retrieveFanart({
            tmdbid: IMDBD_TEST_ID
        });

        images.should.have.length.above(1);
    });

    it('Poster artwork retrieval using TMDBID', async function () {
        const images = await ArtworkRetriever.retrievePoster({
            imdbid: TMDBID_TEST_ID
        });

        images.should.have.length.above(1);
    });

    it('Poster artwork retrieval using IMDBID', async function () {
        const images = await ArtworkRetriever.retrievePoster({
            imdbid: IMDBD_TEST_ID
        });

        images.should.have.length.above(1);
    });
});
