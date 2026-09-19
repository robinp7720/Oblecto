[![npmjs](https://img.shields.io/npm/dw/oblecto.svg)](https://www.npmjs.com/package/oblecto)
[![CI](https://github.com/robinp7720/Oblecto/actions/workflows/ci.yml/badge.svg)](https://github.com/robinp7720/Oblecto/actions/workflows/ci.yml)
[![DeepSource](https://app.deepsource.com/gh/robinp7720/Oblecto.svg/?label=code+coverage&show_trend=true&token=HzJA1q_cYjpl2IVSVTB4Tgz6)](https://app.deepsource.com/gh/robinp7720/Oblecto/)
[![DeepSource](https://app.deepsource.com/gh/robinp7720/Oblecto.svg/?label=active+issues&show_trend=true&token=HzJA1q_cYjpl2IVSVTB4Tgz6)](https://app.deepsource.com/gh/robinp7720/Oblecto/)

![Oblecto logo](https://github.com/robinp7720/Oblecto/blob/master/images/logotype.png?raw=true)

# Oblecto

Oblecto is a self-hosted media server for the movies and TV shows you already own. It indexes your folders, fetches metadata and artwork, and streams to its own web app and to Jellyfin apps.

## Features

- Movie and TV libraries, identified and kept up to date in the background.
- Metadata and artwork from TMDb, TVDB and fanart.tv. Oblecto ships with the project's API keys; you can use your own.
- A web app with browsing, search, continue watching, a full player and remote control of other devices.
- Direct play, and on-the-fly conversion to HLS with FFmpeg when a device needs it.
- A Jellyfin-compatible API on port 8096, so Jellyfin apps on phones, TVs and desktops can sign in and play.
- Accounts with groups and permissions, per-user preferences and avatars, and an optional profile picker on the local network.
- A problem files page for anything that could not be identified or read, with retry.
- Optional federation between Oblecto servers and seedbox import.

Planned for later releases: watchlists, favourites and ratings, editing metadata by hand, and music.

## Install

Oblecto needs Node.js 24 or newer, FFmpeg, and guessit (`python3-guessit` on Debian and Ubuntu, or `pip install guessit`).

### With npm

```sh
npm install -g oblecto
oblecto init            # writes /etc/oblecto/config.json with a random secret
oblecto adduser USERNAME - "Your Name" you@example.com Administrators
oblecto start
```

`oblecto adduser` asks for the password when you pass `-`. Then open `http://localhost:8080` and sign in. Add your library folders under Settings.

With SQLite, Oblecto uses the native `sqlite3` module when its binary is installed, and Node's built-in `node:sqlite` otherwise. The native module keeps the server responsive during long queries, which matters for large libraries. npm 12 skips the step that installs its binary, so to get it, allow that step:

```sh
npm install -g --allow-scripts=sqlite3 oblecto
```

The startup log says which one is in use. Installs from a checkout and the Docker image get the native module on their own.

To keep your data somewhere else, run `oblecto init --config-dir DIR` and set `OBLECTO_CONFIG_PATH=DIR/config.json` for every later command.

### As a service

`contrib/oblecto.service` runs Oblecto as its own user under systemd. The install steps are at the top of that file.

### With Docker

```sh
docker run -d --name oblecto \
  -p 8080:8080 -p 8096:8096 \
  -v oblecto-data:/etc/oblecto \
  -v /path/to/movies:/movies:ro \
  -v /path/to/shows:/shows:ro \
  ghcr.io/robinp7720/oblecto
docker exec -it oblecto oblecto adduser USERNAME - "Your Name" you@example.com Administrators
```

The first start writes a config into the `/etc/oblecto` volume. Everything Oblecto keeps lives there: config, SQLite database, artwork and logs.

## Configuration

Oblecto reads `OBLECTO_CONFIG_PATH`, or `/etc/oblecto/config.json`. Anything the file leaves out takes its default from [`res/config.json`](res/config.json). Most settings can be changed in the web app under Settings.

| Setting | What it does |
|---|---|
| `server.port` | Web app and API port (8080) |
| `jellyfin.enabled`, `jellyfin.port`, `jellyfin.host` | The Jellyfin-compatible API (on, 8096, all interfaces) |
| `database` | `sqlite` with `storage` for the file, or `mariadb`/`mysql` with `host`, `username`, `password` and `database` |
| `database.migrateOnStart` | Update the database schema when Oblecto starts (on) |
| `movies.directories`, `tvshows.directories` | Library folders |
| `themoviedb.key`, `tvdb.key`, `fanart.tv.key` | Metadata and artwork API keys (the project's, unless you set your own) |
| `authentication.secret` | Signs sign-ins; `oblecto init` generates it |
| `authentication.tokenLifetimeDays` | How long a web sign-in lasts (30) |
| `authentication.profilePicker`, `localPasswordlessLogin`, `allowPasswordlessLogin` | Sign-in without typing a username or password on the local network (all off) |
| `authentication.localSubnets`, `trustProxy` | What counts as the local network, and whether to trust `X-Forwarded-For` |
| `server.corsOrigins` | Other web origins allowed to call the APIs from a browser (none) |
| `logging` | Log `directory` (beside the config file), `level`, `maxSizeMB`, `maxFiles` |
| `indexer.runAtBoot`, `cleaner.runAtBoot` | Scan the libraries, or clean up missing files, at every start (off) |

Oblecto refuses to start without a config file or a signing secret, and says why.

## Groups and permissions

The first start creates two groups. **Administrators** may change settings, manage users and libraries, and run maintenance. **Users** may watch. Put people in groups on the Users settings page, or from the command line:

```sh
oblecto usergroup USERNAME Administrators
```

Oblecto will not delete or demote the last administrator.

## Command line

```
oblecto start | start-tui            Run the server, or with a terminal dashboard
oblecto init [--config-dir DIR]      Write a config, artwork folders and federation keys
oblecto migrate [--status]           Update the database (also runs at start)
oblecto adduser USERNAME - NAME EMAIL [GROUP]
oblecto changepassword USERNAME
oblecto removepassword USERNAME
oblecto usergroup USERNAME GROUP
oblecto deluser USERNAME
```

## Upgrading

Back up your database, install the new version and start it. See [docs/UPGRADING.md](docs/UPGRADING.md) for what changes and what to check.

## Development

```sh
git clone --recurse-submodules https://github.com/robinp7720/Oblecto.git
cd Oblecto
npm ci
npm run build:web
OBLECTO_CONFIG_PATH=/path/to/dev-config.json npm run dev
npm run verify           # lint, typecheck and tests, as CI runs them
```

`npm run build` builds both web apps and the server into `dist/`. `npm run test:network` runs the tests that call the real metadata services. The Playwright suites run with `npm run test:player:ui` and `npm run test:playback:browser`.

To run the web app from Vite's dev server against a local Oblecto, add its origin to `server.corsOrigins`.

API references: [REST](docs/API.md), [realtime](docs/REALTIME_API.md), [streaming](docs/STREAMING.md), and [Jellyfin compatibility](docs/JELLYFIN.md).

## Security

See [SECURITY.md](SECURITY.md) for what Oblecto protects, what it leaves public on purpose, and how to report a problem.

## License

AGPL-3.0-or-later. The bundled Jellyfin web client is GPL-2.0, from [jellyfin-web](https://github.com/jellyfin/jellyfin-web).

## Powered by

<img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg" height="150" title="TMDb API">&emsp;
<img src="https://www.thetvdb.com/images/attribution/logo2.png" height="150" title="tvdb API">
