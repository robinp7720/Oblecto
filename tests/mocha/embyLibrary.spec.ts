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
import { MovieSet, movieSetColumns } from '../../src/models/movieSet.js';
import { SeriesSet, seriesSetColumns } from '../../src/models/seriesSet.js';
import { UserFavourite, userFavouriteColumns } from '../../src/models/userFavourite.js';
import artistsRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/artists/index.js';
import libraryRoutes from '../../src/lib/embyEmulation/ServerAPI/routes/library/index.js';
import { formatId, genreId } from '../../src/lib/embyEmulation/helpers.js';

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

        const req = { params, body: {}, embyUserId: user.id };

        // Read-only, as Express 5 has it
        Object.defineProperty(req, 'query', { get: () => query, enumerable: true });
        await server.handlers.get(route)(req, res);
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
        MovieSet.init(movieSetColumns, { sequelize, modelName: 'MovieSet' });
        SeriesSet.init(seriesSetColumns, { sequelize, modelName: 'SeriesSet' });
        UserFavourite.init(userFavouriteColumns, { sequelize, modelName: 'UserFavourite' });

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
        MovieSet.belongsToMany(Movie, { through: 'MovieSetAllocations' });
        MovieSet.belongsToMany(User, { through: 'MovieSetUsers' });
        Movie.belongsToMany(MovieSet, { through: 'MovieSetAllocations' });
        SeriesSet.belongsToMany(Series, { through: 'SeriesSetAllocations' });
        Series.belongsToMany(SeriesSet, { through: 'SeriesSetAllocations' });

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

        await actor.update({ biography: 'Canadian actor.', birthday: '1964-09-02', placeOfBirth: 'Beirut, Lebanon', metadataUpdatedAt: new Date() });

        const trilogy = await MovieSet.create({ setName: 'Trilogy', public: true });
        const privateSet = await MovieSet.create({ setName: 'Just for viewer', public: false });
        const hiddenSet = await MovieSet.create({ setName: 'Someone else\'s', public: false });

        await (trilogy as any).addMovies([movies[0].id, movies[1].id, movies[2].id]);
        await (privateSet as any).addMovie(movies[5].id);
        await (hiddenSet as any).addMovie(movies[6].id);
        await (privateSet as any).addUser(user.id);

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
        artistsRoutes(server as any, embyEmulation);
        libraryRoutes(server as any, embyEmulation);
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

    describe('collections', () => {
        it('lists the public sets and those shared with this user', async () => {
            const res = await call('GET /items', { ParentId: 'collections' });
            const trilogy = res.body.Items.find((item: any) => item.Name === 'Trilogy');

            assert.deepEqual(names(res), ['Just for viewer', 'Trilogy']);
            assert.equal(trilogy.Type, 'BoxSet');
            assert.equal(trilogy.ChildCount, 3);
            // Movie 01 and Movie 03 are watched
            assert.equal(trilogy.UserData.UnplayedItemCount, 1);
        });

        it('lists a set\'s movies, and nothing of a set this user may not see', async () => {
            const sets = await call('GET /items', { IncludeItemTypes: 'BoxSet', Recursive: 'true', SearchTerm: 'trilogy' });
            const movies = await call('GET /items', { ParentId: sets.body.Items[0].Id });
            const hidden = await MovieSet.findOne({ where: { setName: 'Someone else\'s' } });
            const hiddenMovies = await call('GET /items', { ParentId: formatId(hidden!.id, 'boxset') });
            const hiddenSet = await call('GET /items/:mediaid', {}, { mediaid: formatId(hidden!.id, 'boxset') });

            assert.deepEqual(names(movies), ['Movie 01', 'Movie 02', 'Movie 03']);
            assert.equal(hiddenMovies.body.TotalRecordCount, 0);
            assert.equal(hiddenSet.statusCode, 404);
        });

        it('lists the sets a movie is in', async () => {
            const res = await call('GET /items/:mediaid/collections', {}, { mediaid: formatId(movies[0].id, 'movie') });

            assert.deepEqual(names(res), ['Trilogy']);
        });

        it('describes one set', async () => {
            const sets = await call('GET /items', { ParentId: 'collections', SearchTerm: 'Trilogy' });
            const res = await call('GET /users/:userid/items/:mediaid', {}, { userid: 'me', mediaid: sets.body.Items[0].Id });

            assert.equal(res.body.Name, 'Trilogy');
            assert.equal(res.body.ImageTags.Primary, 'primary');
        });
    });

    describe('people', () => {
        it('lists and finds the people credited in the library', async () => {
            const list = await call('GET /persons', { SearchTerm: 'keanu' });
            const byName = await call('GET /persons/:name', {}, { name: 'Keanu Reeves' });

            assert.deepEqual(names(list), ['Keanu Reeves']);
            assert.equal(byName.body.Type, 'Person');
            assert.equal(byName.body.Overview, 'Canadian actor.');
            assert.deepEqual(byName.body.ProductionLocations, ['Beirut, Lebanon']);
            assert.equal(byName.body.ImageTags.Primary, 'primary');
        });

        it('describes a person by id, as a client opening a cast member does', async () => {
            const list = await call('GET /persons', { SearchTerm: 'Keanu' });
            const res = await call('GET /users/:userid/items/:mediaid', {}, { userid: 'me', mediaid: list.body.Items[0].Id });

            assert.equal(res.body.Name, 'Keanu Reeves');
            assert.match(res.body.PremiereDate, /^1964-09-02/);
            // Apps only show the rows of a person's work that these say exist
            assert.equal(res.body.MovieCount, 1);
            assert.equal(res.body.SeriesCount, 0);
        });

        it('lists what a person is credited in', async () => {
            const list = await call('GET /persons', { SearchTerm: 'Keanu' });
            const res = await call('GET /items', { PersonIds: list.body.Items[0].Id, IncludeItemTypes: 'Movie,Series', Recursive: 'true' });

            assert.deepEqual(names(res), ['Movie 01']);
        });
    });

    describe('genres', () => {
        it('lists every genre once, per library view', async () => {
            const all = await call('GET /genres');
            const shows = await call('GET /genres', { ParentId: 'shows' });

            assert.deepEqual(names(all), ['Comedy', 'Drama']);
            assert.deepEqual(names(shows), ['Comedy']);
            assert.equal(all.body.Items[0].Id, genreId('Comedy'));
        });

        it('filters items by genre id and describes a genre by id', async () => {
            const res = await call('GET /items', { GenreIds: genreId('Comedy'), IncludeItemTypes: 'Series' });
            const genre = await call('GET /items/:mediaid', {}, { mediaid: genreId('Drama') });

            assert.deepEqual(names(res), ['Show A']);
            assert.equal(genre.body.Type, 'Genre');
            assert.equal(genre.body.Name, 'Drama');
            assert.equal(genre.body.MovieCount, 25);
            assert.equal(genre.body.SeriesCount, 0);
        });

        it('offers the genres and years a view can be filtered by', async () => {
            const filters = await call('GET /items/filters', { ParentId: 'movies' });
            const filters2 = await call('GET /items/filters2', { ParentId: 'shows' });

            assert.deepEqual(filters.body.Genres, ['Comedy', 'Drama']);
            assert.equal(filters.body.Years.length, 25);
            assert.deepEqual(filters2.body.Genres, [{ Name: 'Comedy', Id: genreId('Comedy') }]);
        });
    });

    describe('around an item', () => {
        it('finds similar titles, leaving out the ones its collection already shows', async () => {
            const res = await call('GET /items/:mediaid/similar', { Limit: '5' }, { mediaid: formatId(movies[0].id, 'movie') });

            assert.deepEqual(names(res), ['Movie 04', 'Movie 05', 'Movie 06', 'Movie 07', 'Movie 08']);
        });

        it('lists an episode\'s season, series and library view', async () => {
            const episode = await Episode.findOne({ where: { airedSeason: '2' } });
            const res = await call('GET /items/:mediaid/ancestors', {}, { mediaid: formatId(episode!.id, 'episode') });

            assert.deepEqual(res.body.map((item: any) => item.Name), ['Season 2', 'Show A', 'Shows']);
        });

        it('counts the library', async () => {
            const res = await call('GET /items/counts');

            assert.equal(res.body.MovieCount, 25);
            assert.equal(res.body.SeriesCount, 1);
            assert.equal(res.body.EpisodeCount, 5);
            assert.equal(res.body.BoxSetCount, 2);
        });

        it('recommends titles like the ones just watched', async () => {
            const res = await call('GET /movies/recommendations', { CategoryLimit: '1', ItemLimit: '3' });

            assert.equal(res.body.length, 1);
            assert.equal(res.body[0].RecommendationType, 'SimilarToRecentlyPlayed');
            assert.equal(res.body[0].Items.length, 3);
        });
    });

    describe('favourites', () => {
        const heart = async (id: string, favourite = true) => (await call(`${favourite ? 'POST' : 'DELETE'} /userfavoriteitems/:itemid`, {}, { itemid: id })).body;

        it('marks any kind of item as a favourite and lists them together', async () => {
            const person = (await call('GET /persons', { SearchTerm: 'Keanu' })).body.Items[0];
            const set = (await call('GET /items', { ParentId: 'collections', SearchTerm: 'Trilogy' })).body.Items[0];
            const series = formatId(show.id, 'series');

            assert.equal((await heart(formatId(movies[9].id, 'movie'))).IsFavorite, true);
            await heart(series);
            await heart(person.Id);
            await heart(set.Id);

            const favourites = await call('GET /items', { IncludeItemTypes: 'Movie,Series,BoxSet', Recursive: 'true', Filters: 'IsFavorite' });
            const people = await call('GET /persons', { Filters: 'IsFavorite' });
            const detail = await call('GET /items/:mediaid', {}, { mediaid: series });

            assert.deepEqual(names(favourites), ['Movie 10', 'Show A', 'Trilogy']);
            assert.ok(favourites.body.Items.every((item: any) => item.UserData.IsFavorite));
            assert.deepEqual(names(people), ['Keanu Reeves']);
            assert.equal(detail.body.UserData.IsFavorite, true);
        });

        it('takes a favourite back, and ignores marking one twice', async () => {
            const id = formatId(movies[10].id, 'movie');

            await heart(id);
            await heart(id);
            assert.equal(await UserFavourite.count({ where: { itemType: 'movie', itemId: movies[10].id } }), 1);

            assert.equal((await heart(id, false)).IsFavorite, false);
            assert.equal((await call('GET /items', { IncludeItemTypes: 'Movie', IsFavorite: 'true' })).body.TotalRecordCount, 1);
        });

        it('refuses an id that names nothing a user can favourite', async () => {
            const res = await call('POST /userfavoriteitems/:itemid', {}, { itemid: 'movies' });

            assert.equal(res.statusCode, 404);
        });
    });
});
