[![npmjs](https://img.shields.io/npm/dw/oblecto.svg)](https://www.npmjs.com/package/oblecto)
[![Join the chat at https://gitter.im/robinp7720/Oblecto](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/robinp7720/Oblecto?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![DeepSource](https://app.deepsource.com/gh/robinp7720/Oblecto.svg/?label=code+coverage&show_trend=true&token=HzJA1q_cYjpl2IVSVTB4Tgz6)](https://app.deepsource.com/gh/robinp7720/Oblecto/)
[![DeepSource](https://app.deepsource.com/gh/robinp7720/Oblecto.svg/?label=active+issues&show_trend=true&token=HzJA1q_cYjpl2IVSVTB4Tgz6)](https://app.deepsource.com/gh/robinp7720/Oblecto/)
[![DeepSource](https://app.deepsource.com/gh/robinp7720/Oblecto.svg/?label=resolved+issues&show_trend=true&token=HzJA1q_cYjpl2IVSVTB4Tgz6)](https://app.deepsource.com/gh/robinp7720/Oblecto/)

![Oblecto logo](https://github.com/robinp7720/Oblecto/blob/master/images/logotype.png?raw=true)
# Oblecto
## What is it?
Oblecto is a self-hosted media server for streaming the media you already own. It indexes Movies and TV Shows, enriches them with metadata and artwork, and serves them through a web interface or compatible clients.

## Features
- Movie and TV library indexing with background updates.
- Metadata and artwork from TMDb, TVDB, and Fanart.tv (bring your own API keys).
- Built-in web UI (Oblecto-Web) served by the backend.
- Jellyfin/Emby API emulation for compatible clients (port `8096`).
- Streaming sessions with direct play and recode/HLS support (via FFmpeg).
- Optional federation and seedbox import support.
- CLI tools for setup, database init, and user management.

## What Oblecto can do
- Scan folders of Movies/TV, identify items, and keep your library organized.
- Fetch posters, fanart, episode banners, descriptions, and ratings.
- Serve your library to the web UI and compatible Jellyfin clients.
- Track playback progress and provide "Next Up" for TV series.
- Store assets and metadata in a local database (SQLite by default).

## Setup
Oblecto can be installed using NPM or directly from Git. We recommend NPM unless you plan to develop.

### Quick start (npm)
1. Install: `npm install -g oblecto`
2. Initialize config and assets: `oblecto init`
3. Edit `/etc/oblecto/config.json` and set:
   - `movies.directories` and `tvshows.directories`
   - API keys: `themoviedb.key`, `tvdb.key`, `fanart.tv.key`
   - Database settings (SQLite by default)
4. Initialize the database: `oblecto init database`
5. Start the server: `oblecto start` (or `oblecto start-tui`)
6. Open the web UI at `http://localhost:8080/web` (or the port set in `server.port`)

### From source (development)
1. Install dependencies: `npm install`
2. Build the web UI: `npm run build:web`
3. Build or run the backend:
   - `npm run build` then `npm run start`, or
   - `npm run dev` for live development
4. Use the CLI if needed: `npm run oblecto` (or `npm run oblecto:dev`)

### Configuration notes
- Config path order: `OBLECTO_CONFIG_PATH` -> `./res/config.json` -> `/etc/oblecto/config.json`
- Default SQLite file: `/etc/oblecto/database.sqlite`
- Sample config template: `res/config.json`

Need help? Ask in the gitter chat or check the setup guide:
https://github.com/robinp7720/Oblecto/wiki/Getting-Started


## Powered by
<img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg" height="150" title="TMDb API">&emsp;
<img src="https://www.thetvdb.com/images/attribution/logo2.png" height="150" title="tvdb API">
