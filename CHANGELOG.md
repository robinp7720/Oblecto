# Changelog

## Unreleased

Upgrading from 1.0? The database updates itself at start (migrations 0006 to 0016). If you use federation, upgrade both servers together: synchronization now needs metadata protocol 2 on each end. See [docs/UPGRADING.md](docs/UPGRADING.md).

### New

- Desktop-client API documentation with a complete native endpoint index, response models, HTTP examples, playback lifecycle, realtime integration and an implementation checklist.
- Series and episode pages now use focused banners. Series add private favourites/watchlists with TV-library filters, trailers, regional ratings, library viewing progress and season watch actions. Episode matching lives in a separate Library tools workspace restricted to library managers; exact TMDB IDs handle anime season-order differences, with uncertain matches, specials and future releases separated from absent episodes.
- Episode pages add favourites, remaining/finish time, a nearby-season navigator, and chapter playback when file chapters exist. Both page types expose full crew and IMDb/TMDB/TVDB links.
- Account preferences can hide unwatched artwork and synopsis, optionally titles too, with temporary per-episode reveals. The preference also protects episode cards, adjacent previews, catalogue titles and chapter names.
- Movie pages have favourites and private watchlists, with matching library filters. Movie favourites share their existing storage with Jellyfin apps; migration 0013 adds watchlists.
- On-demand trailers and regional age certifications from TMDB, cached for seven days and preserved when refreshes fail. Movie pages also include full crew by department, IMDb/TMDB links, viewing progress, estimated finish times, and expanded audio/subtitle details for each file version.
- Next-episode offers use episode-card artwork and details with a borderless credits indicator, small text actions and a subtle countdown strip. Cards appear at terminal credits, or the final 30 seconds without markers, replacing the legacy 90% threshold. A default-on account preference asks “Are you still watching?” before autoplay continues after 90 minutes without interaction.
- Personal viewing statistics and a permission-controlled server dashboard with full session history, active watch time, distinct-coverage completions, repeat plays, library totals and playback-health charts. Native and Jellyfin clients share collection; migration 0012 stores history and operational summaries. The statistics page groups key metrics and tables into responsive panels, with chart scales, playback-method bars and expandable measurement notes.

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

### Performance

- Migration 0015 adds browse-order, episode-series, tracking and reverse file-link indexes without changing existing rows. SQLite refreshes planner statistics after migration and uses bounded optimization at startup and hourly.
- Library facets aggregate distinct genre/year pairs in SQL and share a bounded cache scoped to database, viewer and filters, with catalogue/user-state invalidation after writes and transaction commits.
- Remux sessions share cached keyframe timelines across sessions and revisions; changed files are rescanned and one cancelled viewer does not interrupt another's scan.
- Web pages and the player load on demand. Remote play remains available before the player is loaded, and idle devices keep reporting their state.
- Playback diagnostics include preparation stages, first media delivery and browser time to first playback. Startup timing now includes preparation and ignores HEAD and failed media requests.

### Fixed

- Legacy MySQL/MariaDB upgrades recover from the 64-index limit caused by older Sequelize alter-syncs. Migration 0016 removes only numbered exact copies of provider-ID indexes, retaining the original unique constraints and every row.

- Copy stream URL now returns a direct HTTP link to the original file, including MKV/HEVC and surround audio, instead of negotiating HLS using browser defaults. Session creation accepts `forceDirect: true` for external players.

- Media identification preserves useful metadata when later providers return missing or invalid values. TVDB episode matching no longer treats absent names or incomplete numbering as a match.
- FTP seedbox imports honor the configured port and close transfer connections after success or failure.

- Playback scheduling releases capacity when a task throws before returning a promise, and waits for queued work to finish when settling. Background job names no longer collide with inherited object properties, and workers no longer allocate unused timeout timers.

- Navigating between Home, TV Shows, Movies and detail pages preserves the outgoing page's spacing during its fade, avoiding sudden shifts and resizes.

- Movie banners use a focused layout with playback, trailers, a watchlist bookmark and a More menu. Progress appears once beneath the actions; genres, audience ratings and provider links are in About this movie, and technical badges are with Available files.

- The mobile account menu opens as a wide panel just below its avatar, with scrolling constrained to the available viewport.

- Shelf navigation uses centered SVG arrows; shared play icons use explicit alignment without text-baseline spacing.

- Search people results scroll horizontally with shelf navigation. Movie and episode cards share a subdued play control that appears on hover or keyboard focus, with a small corner control on touch screens.

- Mobile playback controls are centered on the video in portrait and landscape, independently of the header and seek bar heights.

- Native movie and series set lists, details and title memberships now hide private sets that are not shared with the signed-in user. Creation keeps new sets accessible to their creator, and no longer reveals an existing unshared private set with the same name. Migration 0011 adds series-set user sharing.
- Invalid set creation requests return HTTP 400 instead of hanging; names and optional descriptions are validated too.

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
