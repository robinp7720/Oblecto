/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-plus-operands, @typescript-eslint/unbound-method, @typescript-eslint/await-thenable, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/no-misused-promises */
import * as chai from 'chai';

import FanarttvMovieArtworkRetriever from '../../src/lib/artwork/movies/artworkRetrievers/FanarttvMovieArtworkRetriever.js';
import Queue from '../../src/lib/queue/index.js';

chai.should();

const TMDBID_TEST_ID = '299534';
const IMDBD_TEST_ID = 'tt4154796';

const oblecto = {
    queue: new Queue(1),
    config: { 'fanart.tv': { key: 'b6821e30b1a791e04d43543936de1fd0' } }
};

describe('FanartTV Movie Artwork Retriever', function () {
    const ArtworkRetriever = new FanarttvMovieArtworkRetriever(oblecto);

    it('Fanart artwork retrieval using TMDBID', async function () {
        const images = await ArtworkRetriever.retrieveFanart({ tmdbid: TMDBID_TEST_ID });

        images.should.have.length.above(1);
    });

    it('Fanart artwork retrieval using IMDBID', async function () {
        const images = await ArtworkRetriever.retrieveFanart({ tmdbid: IMDBD_TEST_ID });

        images.should.have.length.above(1);
    });

    it('Poster artwork retrieval using TMDBID', async function () {
        const images = await ArtworkRetriever.retrievePoster({ imdbid: TMDBID_TEST_ID });

        images.should.have.length.above(1);
    });

    it('Poster artwork retrieval using IMDBID', async function () {
        const images = await ArtworkRetriever.retrievePoster({ imdbid: IMDBD_TEST_ID });

        images.should.have.length.above(1);
    });
});
