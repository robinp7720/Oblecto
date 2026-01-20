/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import * as chai from 'chai';

import TmdbMovieArtworkRetriever from '../../src/lib/artwork/movies/artworkRetrievers/TmdbMovieArtworkRetriever.js';
import Queue from '../../src/lib/queue/index.js';
import { MovieDb } from 'moviedb-promise';

chai.should();

const TMDBID_TEST_ID = '299534';

const oblecto = {
    queue: new Queue(1),
    config: { 'fanart.tv': { key: 'b6821e30b1a791e04d43543936de1fd0' } },
    tmdb: new MovieDb('b06b4917705eeed4e4b273d4c90fe158')
};

describe('Tmdb Movie Artwork Retriever', function () {
    const ArtworkRetriever = new TmdbMovieArtworkRetriever(oblecto);

    it('Fanart artwork retrieval using TMDBID', async function () {
        const images = await ArtworkRetriever.retrieveFanart({ tmdbid: TMDBID_TEST_ID });

        images.should.have.length.above(1);
    });

    it('Poster artwork retrieval using TMDBID', async function () {
        const images = await ArtworkRetriever.retrievePoster({ tmdbid: TMDBID_TEST_ID });

        images.should.have.length.above(1);
    });
});
