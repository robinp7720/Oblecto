# Upgrading

Back up your database before upgrading. For SQLite that is a copy of the database file; for MariaDB or MySQL use `mysqldump`.

## Database changes happen on their own

Oblecto updates the database schema when it starts. Each change is a named migration, recorded in the `SchemaMigrations` table, so it runs once. Migrations preserve application data. They add tables, columns and indexes; compatibility cleanup can remove proven redundant index copies while retaining the original constraints.

To see or apply pending migrations yourself:

```sh
oblecto migrate --status
oblecto migrate
```

To stop Oblecto from changing the schema by itself, set `database.migrateOnStart` to `false`. It then refuses to start until `oblecto migrate` has run.

Databases that were upgraded by hand with the SQL this page used to list are fine: each migration checks for the columns it adds and records itself without changing anything.

## After upgrading from 1.0 to the next release

### New tables and columns

Pending migrations run at the first start:

- `0006-rich-media-metadata` adds `People` and the `MovieCredits`, `SeriesCredits` and `EpisodeCredits` tables, plus scores and episode runtimes.
- `0007-rating-source` records which service each score came from.
- `0008-jellyfin-user-data` adds `UserFavourites` and `JellyfinDisplayPreferences`.
- `0009-federation` adds `FederationRecords`, for pairing and synchronization state.
- `0010-playback-markers` adds cached chapter, segment and thumbnail metadata to files.
- `0011-series-set-sharing` adds explicit user sharing for series sets.
- `0012-statistics` adds viewing sessions, daily watch time and playback-health storage.
- `0013-movie-details` adds `UserWatchlists` (one movie per user per list entry), plus cached movie trailers, regional certifications and their refresh timestamps. Existing movies and favourites are preserved. Watchlist entries are removed when their user or movie is deleted.
- `0014-series-details` adds private `UserSeriesWatchlists` with unique user/show pairs and cascading deletion, plus series trailers, regional TV ratings and a complete episode-catalogue cache. Existing watch history and favourites are preserved. The spoiler preference is stored in the existing user preferences JSON and defaults to showing episode details.

- `0015-browse-indexes` adds indexes for common library sorts, episode/series membership, per-user tracking and reverse file links. Existing rows, including duplicate tracking records, are preserved. SQLite refreshes planner statistics with a bounded `ANALYZE` during this migration. Building indexes takes additional disk space and can lengthen the first startup for a large library.

- `0016-legacy-duplicate-indexes` removes numbered exact copies of unique provider-ID indexes on MySQL/MariaDB media tables. Older Sequelize alter-syncs could accumulate these copies until a table reached MySQL's 64-index limit. The original index and its uniqueness remain in place; rows, columns, primary keys and distinct indexes are preserved. If an earlier index-adding migration hits this limit, the migration runner performs the same targeted cleanup and retries, allowing upgrades to reach migration 0016. SQLite needs no cleanup.

SQLite also runs bounded planner optimization at startup and hourly, following [SQLite's guidance for long-lived connections](https://www.sqlite.org/pragma.html#pragma_optimize). MariaDB and MySQL receive the indexes and continue using their own statistics maintenance.

Trailers and certifications fill on demand when a movie page opens; no library-wide refresh is needed. They require the existing TMDB configuration and a TMDB ID for the movie. Successful results, including empty lists, are cached for seven days; failed requests retain old data and can be retried from the movie page. Movie favourites already saved through Jellyfin appear in the native app's Favourites filter.

### Fill in cast and crew

Titles get cast, crew and a score source the next time their metadata updates. To do it for the whole library at once, run the movie, series and episode updates under Settings → Maintenance → Metadata updates. Until a score is refreshed, the web app labels it "Community rating".

### Upgrade federated servers together

Federation synchronization now uses metadata protocol 2, with no fallback, so upgrade both ends together. Existing `federation.servers` and `federation.clients` entries keep working; keep their aliases unchanged. See [FEDERATION.md](FEDERATION.md).

### Check your configuration

All new settings have defaults, so nothing needs changing:

- `jellyfin.serverName` ("Oblecto"), `jellyfin.loginDisclaimer` and `jellyfin.customCss` (empty) set what Jellyfin apps show.
- `federation.syncIntervalMs` (fifteen minutes) sets how often federated catalogs synchronize.
- `assets.personProfileLocation` (`/etc/oblecto/assets/personProfiles/`) holds people's photos. Oblecto creates it when it saves the first one.

## After upgrading to 1.0

### Everyone signs in again

Sign-in tokens now expire, after `authentication.tokenLifetimeDays` (30 by default), and stop working when the password changes. Tokens from earlier versions are not accepted, so every browser and app signs in once more.

Jellyfin apps sign in again as well. Their tokens now survive restarts, which earlier versions did not.

### Promote an administrator

The first start creates the **Administrators** and **Users** groups. Users who existed before start in no group, which grants no permissions, so nobody can open the server settings until you promote someone:

```sh
oblecto usergroup USERNAME Administrators
```

Put everyone else in **Users**, or in a group of your own, from the Users page under settings.

### Check your configuration

- Oblecto reads `OBLECTO_CONFIG_PATH`, or `/etc/oblecto/config.json`. It no longer reads `res/config.json` from the working directory.
- It refuses to start without `authentication.secret`, or with the old placeholder `secret`. `oblecto init` writes a random one.
- Settings missing from your file take their defaults from `res/config.json`. Two defaults changed: `authentication.allowPasswordlessLogin` and `authentication.profilePicker` are now off. Set them to `true` to keep the old behaviour.
- The Jellyfin API has its own section, `jellyfin`, with `enabled`, `port` (8096) and `host` (0.0.0.0).

## Private sets

Migration `0011-series-set-sharing` adds the user-sharing relation for series sets. Native movie and series listings, set contents and title memberships now show only public sets or sets shared with the caller, including administrators. New sets are automatically shared with their creator. Existing movie shares are preserved; older private series sets have no stored owner, so remain hidden until explicitly shared. The upgrade neither guesses an owner nor makes private sets public.

### Viewing statistics (migration 0012)

Startup creates `ViewingSessions`, `ViewingDays`, `PlaybackHealth`, and `StatisticsMeta`, with indexes
for viewing ranges, history and operational sampling. Existing progress records are unchanged and
cannot be backfilled as viewing history. Collection begins after this upgrade. The Administrators
group receives the new `statistics.view` permission; custom groups must be granted it explicitly.

The account menu's **Statistics** page shows personal activity; **Settings → Statistics** shows all
viewers, current library totals and playback health to authorized users. Individual viewing history
is retained indefinitely and increases database size with usage. Minute health data is retained for
30 days and hourly summaries indefinitely. No new configuration or external service is required.
Deleted media keeps its historical title; deleting an account removes its identifiable history.
