/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import assert from 'node:assert/strict';

import FanarttvMovieArtworkRetriever from '../../src/lib/artwork/movies/artworkRetrievers/FanarttvMovieArtworkRetriever.js';
import Queue from '../../src/lib/queue/index.js';

import { FANART_KEY } from './keys.js';



const TMDBID_TEST_ID = 299534;
const IMDBD_TEST_ID = 'tt4154796';

const oblecto = {
    queue: new Queue(1),
    config: { 'fanart.tv': { key: FANART_KEY } }
};

describe('FanartTV Movie Artwork Retriever', function () {
    const ArtworkRetriever = new FanarttvMovieArtworkRetriever(oblecto);

    it('Fanart artwork retrieval using TMDBID', async function () {
        const images = await ArtworkRetriever.retrieveFanart({ tmdbid: TMDBID_TEST_ID });

        assert.ok(images.length > 1);
    });

    it('Fanart artwork retrieval using IMDBID', async function () {
        const images = await ArtworkRetriever.retrieveFanart({ imdbid: IMDBD_TEST_ID });

        assert.ok(images.length > 1);
    });

    it('Poster artwork retrieval using TMDBID', async function () {
        const images = await ArtworkRetriever.retrievePoster({ tmdbid: TMDBID_TEST_ID });

        assert.ok(images.length > 1);
    });

    it('Poster artwork retrieval using IMDBID', async function () {
        const images = await ArtworkRetriever.retrievePoster({ imdbid: IMDBD_TEST_ID });

        assert.ok(images.length > 1);
    });
});
