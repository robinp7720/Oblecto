require('chai/register-should');  // Using Should style

const { default: TmdbMovieArtworkRetriever } = require('../../dist/lib/artwork/movies/artworkRetrievers/TmdbMovieArtworkRetriever');
const { default: Queue } = require('../../dist/lib/queue');
const { MovieDb } = require('moviedb-promise');

const TMDBID_TEST_ID = '299534';

const oblecto = {
    queue: new Queue(1),
    config: {
        'fanart.tv': {
            key: 'b6821e30b1a791e04d43543936de1fd0'
        }
    },
    tmdb: new MovieDb('b06b4917705eeed4e4b273d4c90fe158')
};

describe('Tmdb Movie Artwork Retriever', function () {
    const ArtworkRetriever = new TmdbMovieArtworkRetriever(oblecto);

    it('Fanart artwork retrieval using TMDBID', async function () {
        const images = await ArtworkRetriever.retrieveFanart({
            tmdbid: TMDBID_TEST_ID
        });

        images.should.have.length.above(1);
    });

    it('Poster artwork retrieval using TMDBID', async function () {
        const images = await ArtworkRetriever.retrievePoster({
            tmdbid: TMDBID_TEST_ID
        });

        images.should.have.length.above(1);
    });
});
