# Changelog

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
