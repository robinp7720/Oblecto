import assert from 'node:assert/strict';
import { Op, Sequelize, literal, type FindOptions } from 'sequelize';
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { TrackMovie, trackMovieColumns } from '../../src/models/trackMovie.js';
import { UserFavourite, userFavouriteColumns } from '../../src/models/userFavourite.js';
import { browseFacets } from '../../src/submodules/REST/routes/helpers/facets.js';
import { parseBrowseParams } from '../../src/submodules/REST/routes/helpers/browse.js';

describe('Browse facet aggregation and freshness', () => {
    let database: Sequelize;
    let reads: number;
    beforeEach(async () => {
        database = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });
        Movie.init(movieColumns, { sequelize: database, modelName: 'Movie' });
        TrackMovie.init(trackMovieColumns, { sequelize: database, modelName: 'TrackMovie' });
        UserFavourite.init(userFavouriteColumns, { sequelize: database, modelName: 'UserFavourite' });
        Movie.hasMany(TrackMovie, { foreignKey: 'movieId' });
        await database.sync({ force: true });
        await Movie.bulkCreate(Array.from({ length: 100 }, (_, i) => ({ id: i + 1, movieName: `Film ${i}`, genres: '["Drama","Comedy"]', releaseDate: '2020-01-01' })));
        reads = 0;
        Movie.addHook('afterFind', rows => {
            reads++;
            assert.equal((rows as unknown[]).length, 1, 'SQL returns one genre/year pair, not every title');
        });
    });
    afterEach(async () => { await database.close(); });
    const read = (raw: Record<string, unknown> = {}, userId = 1, options: FindOptions = { include: [] }) =>
        browseFacets(Movie, parseBrowseParams(raw), userId, options, 'genres', 'releaseDate');

    it('aggregates in SQL and shares results across concurrent requests, cursors and sort changes', async () => {
        const results = await Promise.all([read(), read({ cursor: 'ignored-for-facets', order: 'desc' }), read({ count: 1, sort: 'popularity' })]);
        assert.deepEqual(results[0], { genres: ['Comedy', 'Drama'], years: [2020] });
        assert.deepEqual(results[0], results[1]);
        assert.equal(reads, 1);
        await read({}, 2);
        assert.equal(reads, 2, 'viewers do not share entries');
    });

    it('invalidates catalogue changes including bulk writes and deletes', async () => {
        await read();
        await Movie.update({ genres: 'Comedy' }, { where: {} });
        assert.deepEqual((await read()).genres, ['Comedy']);
        await Movie.destroy({ where: {} });
        assert.equal(reads, 2);
        // Empty aggregate results are valid too.
        const result = await browseFacets(Movie, parseBrowseParams({}), 1, { include: [], hooks: false }, 'genres', 'releaseDate');
        assert.deepEqual(result, { genres: [], years: [] });
    });

    it('invalidates tracking only for filtered facets and scopes saved-list changes to their owner', async () => {
        const watched: FindOptions = { include: [{ model: TrackMovie, required: true, where: { userId: 1, progress: { [Op.gte]: 0.9 } } }] };
        await TrackMovie.create({ userId: 1, movieId: 1, progress: 1 });
        await read({ watched: 'watched' }, 1, watched);
        await read();
        const track = (await TrackMovie.findOne())!;
        await track.update({ progress: 0.95 });
        await read();
        assert.equal(reads, 2, 'unfiltered facets survive progress writes');
        await read({ watched: 'watched' }, 1, watched);
        assert.equal(reads, 3);
        const saved = (userId: number): FindOptions => ({ include: [], where: { id: { [Op.in]: literal(`(SELECT itemId FROM UserFavourites WHERE userId = ${userId})`) } } });
        await UserFavourite.bulkCreate([1, 2].map(userId => ({ userId, itemType: 'movie', itemId: 1 })));
        await read({ list: 'favourites' }, 1, saved(1));
        await read({ list: 'favourites' }, 2, saved(2));
        await UserFavourite.create({ userId: 1, itemType: 'movie', itemId: 2 });
        await read({ list: 'favourites' }, 2, saved(2));
        assert.equal(reads, 5, 'another viewer keeps their cached facets');
        await read({ list: 'favourites' }, 1, saved(1));
        assert.equal(reads, 6);
    });

    it('discards cached reads again when a transaction commits', async () => {
        await read();
        await database.transaction(async transaction => {
            await Movie.update({ genres: 'Comedy' }, { where: {}, transaction });
            await read();
            assert.equal(reads, 2);
        });
        assert.deepEqual((await read()).genres, ['Comedy']);
        assert.equal(reads, 3);
    });
});
