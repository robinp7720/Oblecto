import assert from 'node:assert/strict';
import EpisodeLibraryClient from '../../Oblecto-Web/src/oblecto-client/src/OblectoLibraryClients/EpisodeLibraryClient.js';
import MovieLibraryClient from '../../Oblecto-Web/src/oblecto-client/src/OblectoLibraryClients/MovieLibraryClient.js';
import SeriesLibraryClient from '../../Oblecto-Web/src/oblecto-client/src/OblectoLibraryClients/SeriesLibraryClient.js';

for (const [media, Client] of [['movies', MovieLibraryClient], ['series', SeriesLibraryClient]] as const) {
    describe(`${media} browse client`, () => {
        it('requests the browse envelope and forwards filters and the next-page cursor', async () => {
            const envelope = {
                items: [{ id: 12 }],
                facets: { genres: ['Drama'] },
                pageInfo: {
 hasNextPage: true, nextCursor: 'next-page', count: 1 
}
            };
            const client = new Client({
 axios: {
                get(url: string, config: { params: Record<string, unknown> }) {
                    assert.equal(url, `/${media}/list/createdAt`);
                    assert.deepEqual(config.params, {
                        mode: 'browse',
order: 'desc',
count: 30,
                        q: 'Space & time',
genre: 'Drama,Science Fiction',
                        watched: 'inprogress',
libraryPath: '/media/library',
                        yearFrom: 2000,
yearTo: 2026,
cursor: 'previous-page'
                    });
                    return Promise.resolve({ data: envelope });
                }
            } 
});

            const result = await client.browse({
                sort: 'createdAt',
order: 'desc',
count: 30,
                q: 'Space & time',
genre: ['Drama', 'Science Fiction'],
                watched: 'inprogress',
libraryPath: '/media/library',
                yearFrom: 2000,
yearTo: 2026,
cursor: 'previous-page'
            });
            assert.deepEqual(result, envelope);
        });

        it('defaults to date added and propagates API failures', async () => {
            const failure = new Error('Server unavailable');
            const client = new Client({
 axios: {
                get(url: string, config: { params: Record<string, unknown> }) {
                    assert.equal(url, `/${media}/list/createdAt`);
                    assert.equal(config.params.mode, 'browse');
                    return Promise.reject(failure);
                }
            } 
});
            await assert.rejects(client.browse(), error => error === failure);
        });
    });
}

describe('Media search clients', () => {
    for (const [route, Client] of [['movies', MovieLibraryClient], ['shows', SeriesLibraryClient], ['episodes', EpisodeLibraryClient]] as const) {
        it(`encodes the search term as one path segment for ${route}`, async () => {
            const client = new Client({ axios: { get: async (url: string) => {
                assert.equal(url, `/${route}/search/Face%2FOff%3F%20%231%20(100%25)`);
                return { data: ['match'] };
            } } });
            assert.deepEqual(await client.search('Face/Off? #1 (100%)'), ['match']);
        });
    }
});
