# Changelog

## Unreleased

Upgrading from 1.0? The database updates itself at start (migrations 0006 to 0010). If you use federation, upgrade both servers together: synchronization now needs metadata protocol 2 on each end. See [docs/UPGRADING.md](docs/UPGRADING.md).

### New

- Chapters in Playback settings and on the seek bar, thumbnail previews while scrubbing, and skip buttons for intros, credits, recaps and previews. Local files are analysed after indexing; existing libraries can use Settings → Maintenance → Analyse playback. Chapter titles provide segments, and FFmpeg with chromaprint also detects shared episode intros and credits. Jellyfin apps receive chapters, thumbnails and segment ranges too.
- Per-file manual segment correction through the API. `streaming.trickplay`, `streaming.trickplayInterval`, `streaming.detectSegments` and `assets.trickplayLocation` configure analysis; migration 0010 stores its results.

- Cast and crew for movies, series and episodes, from TMDb. People have their own page with biography and photo, and libraries can be filtered by person and role.
- Movie and series pages suggest related titles from your library; episode pages show the previous and next episode and where they sit in the season. Series have fanart.
- Audience scores say which service they came from.
- The web app updates on its own when titles are added or their metadata or artwork changes, and when progress is saved on another device or in a Jellyfin app.
- The web app's home page leads with what you were watching, Discover has popular and top rated titles, the player plays the next episode with a countdown, and settings save the same way throughout.
- Jellyfin apps browse with correct paging, sorting and filters, and see real metadata: genres, provider links, taglines, cast and crew, and season and episode counts. Collections, person and genre pages, similar titles and recommendations work.
- Favourites in Jellyfin apps, kept per user, for movies, series, seasons, episodes, people and collections.
- Jellyfin apps save their audio and subtitle preferences as your Oblecto preferences, and keep their display settings per user and app.
- A Jellyfin app's dashboard shows and saves the server name, hardware encoder, sign-in text and custom CSS (new `jellyfin.serverName`, `jellyfin.loginDisclaimer` and `jellyfin.customCss`); so does the new Settings → Jellyfin apps page.
- Watched state, progress and favourites are pushed to open Jellyfin apps, and their sockets stay connected. Oblecto reports Jellyfin API version 12.1.0.
- Federation pairs servers with a one-time invitation, synchronizes catalogs as consistent snapshots every fifteen minutes (`federation.syncIntervalMs`), and has an administration page and API. See [docs/FEDERATION.md](docs/FEDERATION.md).

### Fixed

- Every page of a Jellyfin listing after the first came back wrong.
- jellyfin-web and other apps built on the Jellyfin SDK could not open the socket, and opening a series in them failed.
- A metadata refresh no longer blanks values the provider left out, and a failed cast or crew lookup no longer throws away the rest of the update.
- Federation keeps the previous catalog when a synchronization is interrupted, and removes files the other server no longer shares.
- Next Up (`GET /episodes/next`) works on SQLite; it answered 501 there. On MariaDB and MySQL it no longer skips past episode 99 of a season or season 99 of a series, and it lists the series you watched most recently first.

## 1.0.1

### Fixed

- A global npm install could not open its SQLite database, because npm 12 skips the install step of the native sqlite3 package. Oblecto now falls back to Node's built-in `node:sqlite` when sqlite3's binary is missing; `npm install -g --allow-scripts=sqlite3 oblecto` keeps the native module.
- `oblecto adduser` straight after `oblecto init` failed with "no such table: Groups". User commands now update the database first.
- A busy port crashed the server. The Jellyfin API now logs it and Oblecto keeps running; for the main port Oblecto stops and says which port is taken.

## 1.0.0

Upgrading from 0.3? Read [docs/UPGRADING.md](docs/UPGRADING.md) first: everyone signs in again, you promote an administrator, and a few defaults changed.

### New

- Accounts with groups and permissions, and self-service profile, password, avatar and playback preferences.
- A profile picker and password-less sign-in on the local network, both off by default.
- Library browsing with filters, sorting and paging; a rebuilt player with track selection, speed, hotkeys and remote control.
- A problem files page that says why a file could not be identified or read, and retries the step that failed.
- Database migrations. The schema updates itself at start, or with `oblecto migrate`.
- The Jellyfin API keeps played state, continue watching and password changes, and its tokens survive restarts.
- `oblecto init --config-dir`, prompted passwords in the CLI, and a systemd unit in `contrib/`.
- A Docker image that runs as an unprivileged user with its data in a volume.
- Rotating log files beside the config file, configured under `logging`.

### Security

- The Jellyfin API on port 8096 required no sign-in for anything but streams, listed every user with their administrator flag, and answered as user 1 to every client. It now requires a session and only shows the signed-in user's data.
- Oblecto no longer reads `res/config.json` from the working directory, which made Docker and source installs run with the sample's placeholder signing secret. It refuses to start without a real one.
- Sign-in tokens expire and end with a password change or account deletion.
- Failed sign-ins are throttled.
- Other websites can no longer call the APIs from a user's browser.
- Uploads are limited to 25 MB and accepted only after the permission check.
- Access tokens are no longer written to the log.
- `config.json` and the federation key are created owner-only.

### Fixed

- Artwork uploads failed for every poster, fanart and episode image.
- A TVDB metadata refresh could write one episode's data into an unrelated episode.
- `oblecto init database` failed on a new database with "duplicate column name".
- The web app returned 404 when Oblecto was started from any directory but the checkout.
- Searches treated `%` and `_` as wildcards, and on SQLite matched nothing when they contained them.
- SSH seedboxes connected without the configured username.
- Latest items hung for most library views, and the latest and resume rows of Jellyfin apps pointed at the wrong route.
- The file clean-up removed a whole library when its network share had not mounted yet.
- `oblecto start` skipped the graceful shutdown on SIGTERM; a missing guessit, federation key or busy Jellyfin port stopped the server.
- Settings that nothing read are gone, and the at-boot scan and clean-up settings now work.

### For developers

- CI runs lint, a typecheck, the unit and browser suites, the startup smoke tests and a package check on every push, and publishes to npm from version tags.
- Tests that call live metadata services moved to `npm run test:network`.
