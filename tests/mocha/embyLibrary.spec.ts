/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
import nodeSqlite from '../../src/submodules/nodeSqlite.js';
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import itemsRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/items/index.js';
import usersRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/users/index.js';
import showsRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/shows/index.js';
import { Movie, movieColumns } from '../../src/models/movie.js';
import { Series, seriesColumns } from '../../src/models/series.js';
import { Episode, episodeColumns } from '../../src/models/episode.js';
import { File, fileColumns } from '../../src/models/file.js';
import { Stream, streamColumns } from '../../src/models/stream.js';
import { MovieFiles, movieFileColumns } from '../../src/models/movieFiles.js';
import { EpisodeFiles, episodeFilesColumns } from '../../src/models/episodeFiles.js';
import { TrackMovie, trackMovieColumns } from '../../src/models/trackMovie.js';
import { TrackEpisode, trackEpisodesColumns } from '../../src/models/trackEpisode.js';
import { User, userColumns } from '../../src/models/user.js';
import { Person, personColumns } from '../../src/models/person.js';
import { MovieCredit, movieCreditColumns } from '../../src/models/movieCredit.js';
import { SeriesCredit, seriesCreditColumns } from '../../src/models/seriesCredit.js';
import { EpisodeCredit, episodeCreditColumns } from '../../src/models/episodeCredit.js';
import { formatId } from '../../src/lib/embyEmulation/helpers.js';

// A route table the handlers register into, and a response that records what they send.
const makeServer = () => {
    const handlers = new Map<string, any>();
    const register = (method: string) => (route: string, handler: any) => { handlers.set(`${method} ${route}`, handler); };

    return {
        handlers, get: register('GET'), post: register('POST'), put: register('PUT'), delete: register('DELETE')
    };
};

const makeRes = () => ({
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    send(payload?: any) { this.body = payload; return this; },
    set(name: string, value: string) { this.headers[name.toLowerCase()] = value; return this; },
    type(value: string) { this.headers['content-type'] = value; return this; }
});

const embyEmulation: any = { serverId: 'test-server-id', sessions: {}, oblecto: { config: { artwork: { poster: {}, fanart: {}, banner: {} } } } };

describe('Jellyfin library browsing', () => {
    let sequelize: Sequelize;
    let user: User;
    let show: Series;
    const movies: Movie[] = [];
    const server = makeServer();

    const call = async (route: string, query: Record<string, unknown> = {}, params: Record<string, unknown> = {}) => {
        const res = makeRes();

        await server.handlers.get(route)({ query, params, body: {}, embyUserId: user.id }, res);
        return res;
    };
    const names = (res: any): string[] => res.body.Items.map((item: any) => item.Name);

    before(async () => {
        sequelize = new Sequelize({ dialect: 'sqlite', dialectModule: nodeSqlite, storage: ':memory:', logging: false });

        Movie.init(movieColumns, { sequelize, modelName: 'Movie' });
        Series.init(seriesColumns, { sequelize, modelName: 'Series' });
        Episode.init(episodeColumns, { sequelize, modelName: 'Episode' });
        File.init(fileColumns, { sequelize, modelName: 'File' });
        Stream.init(streamColumns, { sequelize, modelName: 'Stream' });
        MovieFiles.init(movieFileColumns, { sequelize, modelName: 'MovieFiles' });
        EpisodeFiles.init(episodeFilesColumns, { sequelize, modelName: 'EpisodeFiles' });
        TrackMovie.init(trackMovieColumns, { sequelize, modelName: 'TrackMovie' });
        TrackEpisode.init(trackEpisodesColumns, { sequelize, modelName: 'TrackEpisode' });
        User.init(userColumns, { sequelize, modelName: 'User' });
        Person.init(personColumns, { sequelize, modelName: 'Person' });
        MovieCredit.init(movieCreditColumns, { sequelize, modelName: 'MovieCredit' });
        SeriesCredit.init(seriesCreditColumns, { sequelize, modelName: 'SeriesCredit' });
        EpisodeCredit.init(episodeCreditColumns, { sequelize, modelName: 'EpisodeCredit' });

        Episode.belongsTo(Series);
        Series.hasMany(Episode);
        Episode.belongsToMany(File, { through: EpisodeFiles });
        File.belongsToMany(Episode, { through: EpisodeFiles });
        Movie.belongsToMany(File, { through: MovieFiles });
        File.belongsToMany(Movie, { through: MovieFiles });
        Stream.belongsTo(File);
        File.hasMany(Stream);
        TrackEpisode.belongsTo(Episode, { foreignKey: 'episodeId' });
        Episode.hasMany(TrackEpisode, { foreignKey: 'episodeId' });
        TrackMovie.belongsTo(Movie, { foreignKey: 'movieId' });
        Movie.hasMany(TrackMovie, { foreignKey: 'movieId' });
        MovieCredit.belongsTo(Person, { foreignKey: 'personId' });
        SeriesCredit.belongsTo(Person, { foreignKey: 'personId' });
        EpisodeCredit.belongsTo(Person, { foreignKey: 'personId' });

        await sequelize.sync({ force: true });

        user = await User.create({ username: 'viewer', name: 'Viewer' });

        for (let i = 1; i <= 25; i += 1) {
            movies.push(await Movie.create({
                movieName: `Movie ${String(i).padStart(2, '0')}`,
                releaseDate: `${2000 + i}-06-01`,
                genres: JSON.stringify(i % 5 === 0 ? ['Comedy', 'Drama'] : ['Drama']),
                siteRating: i / 5
            }));
        }

        show = await Series.create({ seriesName: 'Show A', firstAired: '1999-01-01', genre: JSON.stringify(['Comedy']) });

        for (const [season, episode] of [[10, 1], [2, 1], [1, 10], [1, 2], [1, 1]]) {
            await Episode.create({ episodeName: `S${season}E${episode}`, airedSeason: String(season), airedEpisodeNumber: String(episode), SeriesId: show.id });
        }

        await movies[0].update({ tmdbid: 603, imdbid: 'tt0133093', tagline: 'Welcome to the Real World', originalName: 'The Matrix' });
        const actor = await Person.create({ tmdbid: 6384, name: 'Keanu Reeves', profilePath: '/keanu.jpg' });
        const director = await Person.create({ tmdbid: 9340, name: 'Lana Wachowski' });

        await MovieCredit.create({ movieId: movies[0].id, personId: actor.id, creditType: 'cast', character: 'Neo', sortOrder: 0 });
        await MovieCredit.create({ movieId: movies[0].id, personId: director.id, creditType: 'crew', job: 'Director', department: 'Directing', sortOrder: 0 });
        await MovieCredit.create({ movieId: movies[0].id, personId: director.id, creditType: 'crew', job: 'Screenplay', department: 'Writing', sortOrder: 1 });

        const [firstEpisode] = await Episode.findAll({ where: { airedSeason: '1', airedEpisodeNumber: '1' } });

        await TrackEpisode.create({ userId: user.id, episodeId: firstEpisode.id, time: 0, progress: 1 });
        await TrackMovie.create({ userId: user.id, movieId: movies[0].id, time: 0, progress: 1 });
        await TrackMovie.create({ userId: user.id, movieId: movies[1].id, time: 600, progress: 0.5 });
        await TrackMovie.create({ userId: user.id, movieId: movies[2].id, time: 5700, progress: 0.95 });
        // Someone else's progress never shows up
        await TrackMovie.create({ userId: user.id + 1, movieId: movies[3].id, time: 0, progress: 1 });

        itemsRoutes(server as any, embyEmulation);
        usersRoutes(server as any, embyEmulation);
        showsRoutes(server as any, embyEmulation);
    });

    after(async () => { await sequelize.close(); });

    describe('paging', () => {
        it('pages one kind in order, without skipping a page', async () => {
            const pages = await Promise.all([0, 10, 20].map(start => call('GET /items', { IncludeItemTypes: 'Movie', SortBy: 'SortName', Limit: '10', StartIndex: String(start) })));

            assert.deepEqual(pages.map(page => page.body.Items.length), [10, 10, 5]);
            assert.deepEqual(pages.map(page => page.body.TotalRecordCount), [25, 25, 25]);
            assert.deepEqual(pages.flatMap(names), movies.map(movie => movie.movieName));
        });

        it('pages several kinds merged into one order', async () => {
            const res = await call('GET /users/:userid/items', { IncludeItemTypes: 'Movie,Series', Recursive: 'true', Limit: '10', StartIndex: '20' });

            assert.equal(res.body.TotalRecordCount, 26);
            assert.deepEqual(names(res), ['Movie 21', 'Movie 22', 'Movie 23', 'Movie 24', 'Movie 25', 'Show A']);
        });
    });

    describe('sorting and filters', () => {
        it('sorts by premiere date, newest first', async () => {
            const res = await call('GET /items', { IncludeItemTypes: 'Movie', SortBy: 'PremiereDate', SortOrder: 'Descending', Limit: '2' });

            assert.deepEqual(names(res), ['Movie 25', 'Movie 24']);
        });

        it('sorts by rating', async () => {
            const res = await call('GET /items', { IncludeItemTypes: 'Movie', SortBy: 'CommunityRating,SortName', SortOrder: 'Descending', Limit: '1' });

            assert.deepEqual(names(res), ['Movie 25']);
        });

        it('filters by this user\'s watch state', async () => {
            const played = await call('GET /items', { IncludeItemTypes: 'Movie', Filters: 'IsPlayed' });
            const unplayed = await call('GET /items', { IncludeItemTypes: 'Movie', IsPlayed: 'false' });
            const resumable = await call('GET /items', { IncludeItemTypes: 'Movie', Filters: 'IsResumable' });

            assert.deepEqual(names(played), ['Movie 01', 'Movie 03']);
            assert.equal(unplayed.body.TotalRecordCount, 23);
            assert.deepEqual(names(resumable), ['Movie 02']);
        });

        it('filters by genre and year', async () => {
            const comedies = await call('GET /items', { IncludeItemTypes: 'Movie,Series', Recursive: 'true', Genres: 'Comedy' });
            const year = await call('GET /items', { IncludeItemTypes: 'Movie', Years: '2003,2004' });

            assert.deepEqual(names(comedies), ['Movie 05', 'Movie 10', 'Movie 15', 'Movie 20', 'Movie 25', 'Show A']);
            assert.deepEqual(names(year), ['Movie 03', 'Movie 04']);
        });

        it('fetches exactly the ids asked for', async () => {
            const res = await call('GET /items', { Ids: [formatId(movies[4].id, 'movie'), formatId(show.id, 'series')].join(',') });

            assert.deepEqual(names(res), ['Movie 05', 'Show A']);
        });
    });

    describe('watch state', () => {
        it('describes each movie with the signed-in user\'s progress', async () => {
            const res = await call('GET /items', { IncludeItemTypes: 'Movie', Limit: '4' });
            const [watched, started, nearlyDone, others] = res.body.Items.map((item: any) => item.UserData);

            assert.equal(watched.Played, true);
            assert.equal(started.Played, false);
            assert.equal(started.PlaybackPositionTicks, 600 * 10000000);
            // Past the end credits counts as watched, as it does everywhere else in Oblecto
            assert.equal(nearlyDone.Played, true);
            assert.equal(nearlyDone.PlaybackPositionTicks, 0);
            assert.equal(others.Played, false);
        });
    });

    describe('parents', () => {
        it('lists what a library view holds when no type is asked for', async () => {
            const moviesView = await call('GET /items', { ParentId: 'movies', Limit: '1' });
            const showsView = await call('GET /items', { ParentId: 'shows' });

            assert.equal(moviesView.body.TotalRecordCount, 25);
            assert.deepEqual(names(showsView), ['Show A']);
        });

        it('keeps a library view to its own kinds', async () => {
            const res = await call('GET /items', { ParentId: 'shows', IncludeItemTypes: 'Movie' });

            assert.equal(res.body.TotalRecordCount, 0);
        });

        it('lists seasons in numeric order, then a season\'s episodes in numeric order', async () => {
            const seasons = await call('GET /items', { ParentId: formatId(show.id, 'series') });
            const episodes = await call('GET /items', { ParentId: seasons.body.Items[0].Id });

            assert.deepEqual(names(seasons), ['Season 1', 'Season 2', 'Season 10']);
            assert.deepEqual(names(episodes), ['S1E1', 'S1E2', 'S1E10']);
        });

        it('answers a parent that does not exist with nothing', async () => {
            const res = await call('GET /items', { ParentId: 'not-an-id' });

            assert.equal(res.body.TotalRecordCount, 0);
        });

        it('lists a series\' seasons and one season\'s episodes on the /Shows routes', async () => {
            const seasons = await call('GET /shows/:seriesid/seasons', {}, { seriesid: formatId(show.id, 'series') });
            const episodes = await call('GET /shows/:seriesid/episodes', { Season: '1' }, { seriesid: formatId(show.id, 'series') });
            const all = await call('GET /shows/:seriesid/episodes', {}, { seriesid: formatId(show.id, 'series') });

            assert.deepEqual(names(seasons), ['Season 1', 'Season 2', 'Season 10']);
            assert.deepEqual(names(episodes), ['S1E1', 'S1E2', 'S1E10']);
            assert.deepEqual(names(all), ['S1E1', 'S1E2', 'S1E10', 'S2E1', 'S10E1']);
        });
    });

    describe('item details', () => {
        it('describes a movie with what Oblecto knows, and nothing made up', async () => {
            const res = await call('GET /items/:mediaid', {}, { mediaid: formatId(movies[0].id, 'movie') });
            const item = res.body;

            assert.deepEqual(item.Genres, ['Drama']);
            assert.equal(item.GenreItems[0].Name, 'Drama');
            assert.deepEqual(item.ProviderIds, { Tmdb: '603', Imdb: 'tt0133093' });
            assert.deepEqual(item.Taglines, ['Welcome to the Real World']);
            assert.equal(item.OriginalTitle, 'The Matrix');
            assert.equal(item.ProductionYear, 2001);
            assert.equal(item.CommunityRating, 0.2);
            assert.equal(item.OfficialRating, undefined);
            assert.equal(item.CriticRating, undefined);
            assert.equal(item.ImageBlurHashes, undefined);
        });

        it('lists the cast and key crew on the detail page', async () => {
            const res = await call('GET /users/:userid/items/:mediaid', {}, { userid: 'me', mediaid: formatId(movies[0].id, 'movie') });
            const people = res.body.People.map((person: any) => [person.Name, person.Type, person.Role ?? null, Boolean(person.PrimaryImageTag)]);

            assert.deepEqual(people, [
                ['Keanu Reeves', 'Actor', 'Neo', true],
                ['Lana Wachowski', 'Director', 'Director / Screenplay', false],
                ['Lana Wachowski', 'Writer', 'Director / Screenplay', false]
            ]);
            assert.match(res.body.People[0].Id, /^5/);
        });

        it('counts a series\' seasons, episodes and what this user has left to watch', async () => {
            const listed = await call('GET /items', { IncludeItemTypes: 'Series' });
            const series = listed.body.Items[0];
            const seasons = await call('GET /items', { ParentId: series.Id });
            const firstSeason = seasons.body.Items[0];

            assert.equal(series.ChildCount, 3);
            assert.equal(series.RecursiveItemCount, 5);
            assert.equal(series.UserData.UnplayedItemCount, 4);
            assert.equal(series.UserData.Played, false);
            assert.deepEqual(series.Genres, ['Comedy']);
            assert.equal(firstSeason.ChildCount, 3);
            assert.equal(firstSeason.UserData.UnplayedItemCount, 2);
            assert.equal(firstSeason.ParentBackdropItemId, series.Id);
        });
    });
});
