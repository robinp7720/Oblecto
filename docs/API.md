# Oblecto Web API Documentation

This document details the REST API for Oblecto, designed for frontend developers to implement a user interface.

## Base URL
All API endpoints are relative to the server root. Typically this is `http://<server-ip>:<port>`.

## Authentication

### Login
Authenticate a user and retrieve an access token.

- **URL:** `/auth/login`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "username": "your_username",
    "password": "your_password"
  }
  ```
- **Response:**
  ```json
  {
    "accessToken": "eyJhbGciOiJIUz..."
  }
  ```
- **Notes:** Pass the `accessToken` in the `Authorization` header as `Bearer <token>` for subsequent requests.

## Movies

### List Movies
Get a paginated list of movies.

- **URL:** `/movies/list/:sorting`
- **Method:** `GET`
- **URL Params:**
  - `sorting`: Field to sort by (e.g., `movieName`, `year`, `addedAt`).
- **Query Params:**
  - `order`: `asc` or `desc` (default: `asc`).
  - `count`: Number of items per page (default: `20`).
  - `page`: Page number (0-indexed, default: `0`).
- **Response:** Array of Movie objects.

### Get Movie Info
Retrieve detailed information about a specific movie.

- **URL:** `/movie/:id/info`
- **Method:** `GET`
- **Response:** Movie object with `Files` and `TrackMovie` (user progress) included.

### Search Movies
Search for movies by name.

- **URL:** `/movies/search/:name`
- **Method:** `GET`
- **Response:** Array of Movie objects.

### Movie Poster
- **URL:** `/movie/:id/poster`
- **Method:** `GET`
- **Query Params:**
  - `size`: `small`, `medium`, `large`, or original (default: `medium`).

### Upload Movie Poster
- **URL:** `/movie/:id/poster`
- **Method:** `PUT`
- **Body:** Multipart form data with the image file.

### Movie Fanart
- **URL:** `/movie/:id/fanart`
- **Method:** `GET`
- **Query Params:**
  - `size`: `large` (default).

### Upload Movie Fanart
- **URL:** `/movie/:id/fanart`
- **Method:** `PUT`
- **Body:** Multipart form data with the image file.

### Movie Sets
- **List Sets:** `GET /movies/sets`
- **Get Set Details:** `GET /movies/set/:id` (Supports pagination `count`, `page`, `order`).
- **Get Sets for Movie:** `GET /movie/:id/sets`
- **Add Movie to Set:** `PUT /movie/:id/sets` (Body: `{ "setId": 1 }`)

### Watching (Resume)
Get a list of movies currently being watched.

- **URL:** `/movies/watching`
- **Method:** `GET`
- **Response:** Array of Movie objects.

### Play Movie
Redirects to the stream URL for the movie's file.

- **URL:** `/movie/:id/play`
- **Method:** `GET`

## TV Shows (Series)

### List Series
Get a paginated list of TV shows.

- **URL:** `/series/list/:sorting`
- **Method:** `GET`
- **URL Params:** `sorting` (e.g., `seriesName`).
- **Query Params:** `order`, `count`, `page`.
- **Response:** Array of Series objects.

### Get Series Info
- **URL:** `/series/:id/info`
- **Method:** `GET`

### List Episodes in Series
- **URL:** `/series/:id/episodes`
- **Method:** `GET`
- **Response:** Array of Episode objects, ordered by season and episode number.

### Series Poster
- **URL:** `/series/:id/poster`
- **Method:** `GET`
- **Query Params:** `size`.

### Upload Series Poster
- **URL:** `/series/:id/poster`
- **Method:** `PUT`
- **Body:** Multipart form data.

### Search Series
- **URL:** `/shows/search/:name`
- **Method:** `GET`

## Episodes

### List All Episodes
Get a paginated list of episodes from all series.

- **URL:** `/episodes/list/:sorting`
- **Method:** `GET`
- **Query Params:** `order`, `count`, `page`.

### Get Episode Info
- **URL:** `/episode/:id/info`
- **Method:** `GET`

### Get Next Episode
Get the next episode in the series relative to the given episode ID.

- **URL:** `/episode/:id/next`
- **Method:** `GET`

### Episode Banner
- **URL:** `/episode/:id/banner`
- **Method:** `GET`
- **Query Params:** `size`.

### Upload Episode Banner
- **URL:** `/episode/:id/banner`
- **Method:** `PUT`
- **Body:** Multipart form data.

### Search Episodes
- **URL:** `/episodes/search/:name`
- **Method:** `GET`

### Watching (Resume)
Get episodes currently being watched.

- **URL:** `/episodes/watching`
- **Method:** `GET`

### On Deck (Up Next)
Get the next episodes to watch based on watch history.

- **URL:** `/episodes/next`
- **Method:** `GET`

### Play Episode
Redirects to the stream URL for the episode's file.

- **URL:** `/episode/:id/play`
- **Method:** `GET`

## Streaming

Playback uses a viewer-owned session and a server-negotiated delivery method. Positions and durations are **absolute seconds**, including HLS playback; clients must not add a seek offset to media-element timestamps.

### Session control

All control requests require `Authorization: Bearer <token>` and JSON request bodies.

| Method | URL | Purpose |
| --- | --- | --- |
| POST | `/playback/sessions` | Create a session; returns 201 and its descriptor. |
| GET | `/playback/sessions/:id` | Read the current descriptor; does not extend idle expiry. |
| PATCH | `/playback/sessions/:id` | Reconfigure output; requires the current `revision`. |
| POST | `/playback/sessions/:id/progress` | Save absolute position and refresh the session lease; returns 204. |
| DELETE | `/playback/sessions/:id` | Revoke media access, cancel work, and release resources; returns 204, including repeated deletion. |

Creation requires a positive integer `fileId`. Optional fields:

- `position`: nonnegative seconds, default 0; starting positions beyond the duration are clamped to the end.
- `quality`: `original` (default), `auto`, or a height of `360`, `480`, `720`, or `1080`. Original prefers compatible direct playback, then remux, then adaptive transcoding. Auto explicitly requests adaptive HLS. Fixed height selects the highest available rendition at or below that height.
- `maxBitrate`: total bandwidth ceiling in bits/second, at least 200000. Supplying a limit selects adaptive output.
- `audioStreamIndex`, `subtitleStreamIndex`: absolute ffprobe stream indexes, or `null` to disable that track. Omission applies language/default/forced selection. Invalid or negative indexes return 400.
- `subtitleMode`: `off`, `auto` (default), or `forced`.
- `forceHls`: request HLS instead of original delivery, including decoder recovery.
- `capabilities`: `containers`, `videoCodecs`, `audioCodecs`, `profiles` (arrays); `maxLevel`, `maxBitDepth`, `maxAudioChannels`, `maxHeight` (positive numbers); `hdr`, `nativeTracks`, `hls` (booleans). Omitted values use conservative H.264/AAC stereo SDR defaults. Codec levels use ffprobe's numeric convention.

Example descriptor:

```json
{
  "sessionId": "uuid",
  "revision": 1,
  "state": "ready",
  "duration": 7200,
  "position": 123.5,
  "paused": true,
  "method": "transcode",
  "reason": "Adaptive quality requested",
  "mediaUrl": "/playback/media/uuid/1/master.m3u8?token=opaque",
  "selectedTracks": { "audioStreamIndex": 1, "subtitleStreamIndex": null, "subtitleMode": "off" },
  "tracks": [],
  "qualities": [{ "id": "720", "height": 720, "bitrate": 2800000 }],
  "subtitleUrl": null
}
```

`method` is `direct`, `remux`, or `transcode`. `tracks` contains probed audio/subtitle metadata, including indexes, codecs, language tags and dispositions. Quality bitrates describe video; transcoded audio adds 128 kbps. `subtitleUrl` points to WebVTT when a separate text track is selected. ASS/SSA and bitmap subtitles are rendered into video when required.

PATCH accepts the creation options except `fileId`, plus the current integer `revision`. Successful reconfiguration increments the revision and returns replacement URLs. Reject obsolete responses in clients; old media URLs return 409. Create a new session to change files. Supplying `subtitleMode` without an explicit subtitle index reapplies language/default/forced selection. Explicitly pass `forceHls: false` to return to original playback after fallback.

Progress body: `{ "revision": 1, "position": 123.5, "paused": false, "buffering": false }`. Send every ten seconds and on pause, seek completion, stop, and end. Send the final progress update before deleting the session. Progress is saved using existing movie/episode tracking records; stale revisions return 409. Positions beyond duration plus one second are rejected.

### Media delivery

`GET`/`HEAD /playback/media/:id/:revision/:asset` requires the session-scoped `token` query parameter. Use the returned URLs rather than constructing them. Tokens are revoked on deletion, server restart, or idle expiry (30 minutes by default). They grant access to that session's assets, not control operations or other sessions.

Original delivery supports concurrent single byte ranges, suffix ranges, HEAD, 206 and 416 responses. Multiple ranges are rejected with 416. HLS provides full-duration VOD manifests with on-demand segments, enabling immediate arbitrary seeking and quality changes. All advertised segment URLs remain regenerable after cache eviction. No indexing-time preprocessing is required.

Errors use `{ "code": "INVALID_SELECTION", "message": "..." }`: invalid options (400), invalid media token (401), unavailable/foreign session or file (404), stale revision (409), unsupported media (422), unsatisfiable range (416), capacity/storage/encoder failures (503), preparation timeout (504). Capacity responses include `Retry-After: 2`. Once response headers are sent, transport failures close that response.

### Breaking migration

The old `/session/create/:id`, `/session/stream/:id`, and `/HLS/:id/segment/:segment` contracts are removed. Replace codec CSV lists and `noremux` with capabilities and quality preferences. Replace `seeking`, `inputCodec`, and `outputCodec` response handling with the new descriptor. Replace `-1` track sentinels with `null`. Update backend and bundled web/client-library submodules together; restart discards active sessions but retains library and watch-progress data.

Federation media peers must both support protocol version 1; older peers are rejected. Federation metadata synchronization remains unchanged. See [streaming operations and testing](STREAMING.md).

## Users

### List Users
- **URL:** `/users`
- **Method:** `GET`

### Get User Info
- **URL:** `/user/:id`
- **Method:** `GET`

### Create User
- **URL:** `/user`
- **Method:** `POST`
- **Body:** `{ "username": "...", "password": "...", "email": "...", "name": "..." }`

### Update User
- **URL:** `/user/:id`
- **Method:** `PUT`
- **Body:** `{ "username": "...", "password": "...", "email": "...", "name": "..." }`

### Delete User
- **URL:** `/user/:id`
- **Method:** `DELETE`

## Clients (Remote Control)

Remote play has no REST surface. `GET /clients` and `POST /client/:clientId/playback` were removed: device discovery, playback commands and playback state all travel over the realtime socket, which is the only transport that can acknowledge a command and stream state back. See [REALTIME_API.md](REALTIME_API.md).

`GET /api/v1/status/clients` remains, as a read-only diagnostic view of the caller's own connected devices.

## Settings & System (V1)

### Configuration
Manage the core application configuration.

- **Get Full Config:** `GET /api/v1/settings`
- **Update Config:** `PATCH /api/v1/settings`
  - **Body:** JSON object with configuration sections to update (e.g., `{ "server": { "port": 8080 } }`).
- **Get Section:** `GET /api/v1/settings/:section`
- **Update Section:** `PATCH /api/v1/settings/:section`
  - **Body:** JSON object for the section.

### Library Management
Manage media libraries and sources.

- **List Libraries:** `GET /api/v1/libraries`
- **Get Library Paths:** `GET /api/v1/libraries/:type` (`movies` | `tvshows`)
  - **Response:** Array of directory objects (e.g., `[{ "path": "/path/to/media" }]`).
- **Update Library Config:** `PATCH /api/v1/libraries/:type`
- **Add Source Path:** `POST /api/v1/libraries/:type/paths`
  - **Body:** `{ "path": "/path/to/media" }`
- **Remove Source Path:** `DELETE /api/v1/libraries/:type/paths`
  - **Body:** `{ "path": "/path/to/media" }`

### System Maintenance
Trigger background maintenance tasks.

- **Trigger Task:** `POST /api/v1/system/maintenance`
  - **Body:**
    ```json
    {
      "action": "scan" | "update_metadata" | "update_artwork" | "clean",
      "target": "all" | "movies" | "tvshows" | "files"
    }
    ```

### Remote Imports
Trigger imports from configured remote seedboxes.

- **Trigger Import:** `POST /api/v1/system/imports`
  - **Body:**
    ```json
    {
      "source": "all" | "seedbox_name",
      "type": "movies" | "tvshows"
    }
    ```

### System Info
- **Get Info:** `GET /api/v1/system/info`
  - **Response:** `{ "version": "...", "uptime": 123, ... }`

### System Capabilities
Get list of available identifiers and updaters.

- **URL:** `/api/v1/system/capabilities`
- **Method:** `GET`
- **Response:**
  ```json
  {
    "movies": {
      "identifiers": ["tmdb"],
      "updaters": ["tmdb"]
    },
    "tvshows": {
      "seriesIdentifiers": ["tmdb", "tvdb"],
      "episodeIdentifiers": ["tmdb"],
      "seriesUpdaters": ["tmdb", "tvdb"],
      "episodeUpdaters": ["tmdb"]
    }
  }
  ```

## Status (V1)

### Active Sessions

`GET /api/v1/status/sessions` requires authentication and returns only the current user's sessions, including their Emby sessions. Each entry contains `sessionId`, `state`, `file.id`, `method`, `reason`, `position`, `startupMs`, `bufferingReports`, `encodingSpeed`, `failure`, `queueDepth`, `activeEncoders`, `cacheBytes`, and `output` (`format`, `videoCodec`, `audioCodec`). No filesystem paths or media tokens are exposed. Encoding speed is media seconds per wall-clock second; startup is measured from creation to first original/segment delivery.

### Connected Clients
Get the authenticated user's connected realtime devices. Scoped to the caller — there is no role system to gate an all-users view on, and an unfiltered listing was an enumeration oracle for other people's devices. `user` carries the id and nothing else.

- **URL:** `/api/v1/status/clients`
- **Method:** `GET`
- **Permission:** Requires Authentication
- **Response:** Array of the caller's connected devices.
  ```json
  [
    {
      "deviceId": "5f1c…",
      "name": "Living room TV",
      "capabilities": ["control", "playback"],
      "user": {
        "id": 1
      },
      "connectedAt": 1758057600000,
      "state": {
        "status": "playing",
        "media": { "kind": "episode", "id": "1421", "title": "Blink" },
        "position": 61.5,
        "duration": 2700,
        "volume": 0.8,
        "muted": false,
        "canSeek": true,
        "canSetVolume": true,
        "hasNext": true,
        "updatedAt": 1758057600000
      }
    }
  ]
  ```

  `state` mirrors the realtime `PlaybackState`; see [REALTIME_API.md](REALTIME_API.md). For a live view, listen for the `devices` event rather than polling this.

### Seedbox Status
Get the status of the seedbox importer, including configured seedboxes and import queue statistics.

- **URL:** `/api/v1/status/seedbox`
- **Method:** `GET`
- **Permission:** Requires Authentication
- **Response:** Status object.
  ```json
  {
    "seedboxes": [
      {
        "name": "MySeedbox"
      }
    ],
    "queue": {
      "length": 0,
      "running": 0,
      "idle": true
    }
  }
  ```

## Files

### Find Duplicates
- **URL:** `/files/duplicates`
- **Method:** `GET`
- **Response:** List of files with duplicate hashes.

### Problematic Files
Files that failed indexing. `problemStage` says where they failed: `identify` (no movie or episode matched, so nothing is linked to the file) or `probe` (ffprobe could not read it). Rows flagged before stages were recorded have `problemStage: null`. The flag clears itself when the failed stage later succeeds.

- **URL:** `/files/problematic`
- **Method:** `GET`
- **Query Parameters:**
  - `stage` (optional): `identify` or `probe`.
  - `includeIgnored` (optional): `true` to include files marked as ignored.
- **Response:** List of files, newest first, with `id`, `path`, `name`, `directory`, `error`, `problemStage`, `problemIgnored`, `updatedAt`, and the linked `Movies` / `Episodes` (with `Series`).

### Retry Problematic File
Queues the job for the stage that failed: stream analysis for `probe`, identification for `identify`. The file stays problematic until that job succeeds; a failed retry updates `error`. Progress arrives as `indexer` `problem` events (see [REALTIME_API.md](REALTIME_API.md)).

- **URL:** `/files/:id/retry`
- **Method:** `POST`
- **Response (202):** `{ "queued": true, "jobs": ["identifyMovieFile"] }`
- **Errors:** `404` unknown file, `409` file is not problematic, `400` file is outside every library directory, `410` file no longer exists on disk (e.g. it was renamed) and has been removed. A rescan picks up the new name.

### Retry All Problematic Files
Retries every problematic file that is not ignored.

- **URL:** `/files/problematic/retry`
- **Method:** `POST`
- **Body:** `{ "stage": "identify" }` (optional; limits the retry to one stage)
- **Response (202):** `{ "queued": 12, "removedIds": [7], "skippedIds": [42] }`. Removed files no longer existed on disk; skipped files are outside every library directory.

### Ignore Problematic File
Hides a problematic file from the default listing and from Retry All, e.g. samples or extras that will never be identified.

- **URL:** `/files/:id`
- **Method:** `PATCH`
- **Body:** `{ "problemIgnored": true }`
- **Response:** `{ "id": 42, "problemIgnored": true }`
