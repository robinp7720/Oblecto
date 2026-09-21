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
  - `userId` may be sent instead of `username` (used by the profile picker).
  - `password` may be omitted only on the local network, when either `authentication.localPasswordlessLogin` is on and the user has `passwordlessLocal`, or `authentication.allowPasswordlessLogin` is on and the account has no password. Remote clients always need a password.
  - Errors: `400` when the user or a required password is missing, `401` for an unknown user or wrong password.

### Login Options
What the login screen should offer this client. No authentication required.

- **URL:** `/auth/login-options`
- **Method:** `GET`
- **Response:**
  ```json
  {
    "local": true,
    "profilePicker": true,
    "users": [
      { "id": 1, "username": "robin", "name": "Robin", "avatar": "1-1758190000000.webp", "passwordless": true }
    ]
  }
  ```
- **Notes:** `users` holds users with `publicProfile` and is only populated for clients on the local network when `authentication.profilePicker` is not `false`; it never includes emails. `passwordless` means `POST /auth/login` with just `userId` will succeed.

### Local network
A client is local when its address is loopback, private (10/8, 172.16/12, 192.168/16, fc00::/7) or link-local, or falls in one of `authentication.localSubnets` (CIDRs). The TCP peer address is used; `X-Forwarded-For` is only honoured when `authentication.trustProxy` is on, so enable that only behind a reverse proxy that sets it.

### Permissions and groups
Every user belongs to at most one group, and a group grants a fixed set of permissions. Signing in, browsing, playback and managing your own account need none. Endpoints that need a permission answer `403` without it (and `401` without a valid token, or when the token's user has been deleted). Permissions are looked up on every request, so moving someone to another group applies to tokens they already hold.

| Permission | Grants |
|---|---|
| `settings.manage` | All of `/api/v1/settings` (reading included, since it exposes the configuration) |
| `users.manage` | `/users`, creating, editing and deleting users, other users' avatars, and `/api/v1/groups` |
| `libraries.manage` | Library path and indexer changes, creating and deleting sets, putting items in sets, uploading artwork, and `/files` (duplicates, problem files, retries) |
| `system.manage` | Maintenance jobs, remote imports and seedbox status |

Two built-in groups exist and are recreated if missing: **Administrators** (every permission) and **Users** (none). New users join **Users** unless told otherwise. Built-in groups cannot be renamed or deleted, and Administrators always keeps `users.manage`. Any change that would leave nobody holding `users.manage` (deleting or moving the last such user, or taking the permission away from their group) is refused with `409`.

The first administrator is chosen on the server: `oblecto usergroup USERNAME Administrators`. Until someone is, the server logs a warning at startup.

- **List permissions:** `GET /api/v1/permissions` → `[{ "key": "settings.manage", "description": "..." }]`
- **List groups:** `GET /api/v1/groups` → `[{ "id": 1, "name": "Administrators", "permissions": ["settings.manage", ...], "builtIn": true, "members": 1 }]`
- **Create group:** `POST /api/v1/groups` with `{ "name": "Family", "permissions": ["libraries.manage"] }`. `400` for an empty name or unknown permission, `409` if the name is taken.
- **Update group:** `PATCH /api/v1/groups/:id` with `name` and/or `permissions` (the full list).
- **Delete group:** `DELETE /api/v1/groups/:id`. Members move to **Users**.

All group endpoints require `users.manage`.

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
- **Response:** Movie details, files and streams, watch progress, audience score fields, and `credits.cast` / `credits.crew` arrays containing linked people and roles. Every credit includes `libraryConnections: { movies, series }`, counting other top-level titles featuring that person.
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
- **Response:** Series details, audience score fields, and aggregate `credits.cast` / `credits.crew` arrays. Series credits may include `episodeCount`. Every credit includes `libraryConnections: { movies, series }`, counting other top-level titles featuring that person.

### List Episodes in Series
- **URL:** `/series/:id/episodes`
- **Method:** `GET`
- **Response:** Array of Episode objects, ordered by season and episode number.

### Get Sets for Series
- **URL:** `/series/:id/sets`
- **Method:** `GET`
- **Response:** Sets containing the series. Each set includes its member titles in `Series`.

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
- **Response:** Episode details, files and streams, runtime, audience score fields, guest cast, and episode crew. Every credit includes `libraryConnections: { movies, series }`, excluding the current parent series.

### Get Episode Context
- **URL:** `/episode/:id/context`
- **Method:** `GET`
- **Response:** `{ previous, next, season }`, where adjacent episode summaries include current-user tracking and `season` contains `number`, `position`, `episodeCount`, `watchedCount`, `runtimeMinutes`, and `averageRating`. Regular episodes cross season boundaries in numeric order; specials remain in their own sequence.

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

## People and Credits

People are created from credits attached to media in the local library. Person detail and search routes require authentication; profile artwork follows the same public artwork policy as movie and series images.

### Get Person Info
- **URL:** `/person/:id/info`
- **Method:** `GET`
- **Response:** Biography fields and `credits.movies`, `credits.series`, and `credits.episodes`. Each entry contains a local media item and the person's roles; movie and episode items include watch progress for the signed-in user.

### Search People
- **URL:** `/people/search/:name`
- **Method:** `GET`
- **Query Params:** `count` (1–50, default 20).
- **Response:** People referenced by the local library.

### Person Profile
- **URL:** `/person/:id/profile`
- **Method:** `GET`
- **Query Params:** `size`: `small`, `medium`, or `large` (default `medium`).

### Filter Libraries by Person
The browse form of `GET /movies/list/:sorting` and `GET /series/list/:sorting` accepts:

- `personId`: local person ID.
- `creditRole`: `any`, `cast`, `director`, `writer`, or `creator` (default `any`).

Both values are included in cursor validation and `appliedFilters`.

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

User objects look like `{ "id", "username", "name", "email", "publicProfile", "passwordlessLocal", "avatar", "groupId" }`; the password hash is never returned. `publicProfile` shows the user on the local-network profile picker; `passwordlessLocal` lets them sign in there without a password (when the server allows it). `avatar` is the current avatar file name or `null`, and changes with every upload.

Everything here needs `users.manage`, except that users may read their own record and change their own avatar.

### List Users
- **URL:** `/users`
- **Method:** `GET`

### Get User Info
- **URL:** `/user/:id`
- **Method:** `GET`

### Create User
- **URL:** `/user`
- **Method:** `POST`
- **Body:** `{ "username": "...", "password": "...", "email": "...", "name": "...", "publicProfile": false, "passwordlessLocal": false, "groupId": 2 }` (`groupId` optional; defaults to the **Users** group)

### Update User
- **URL:** `/user/:id`
- **Method:** `PUT`
- **Body:** `{ "username": "...", "password": "...", "email": "...", "name": "...", "publicProfile": true, "passwordlessLocal": false, "groupId": 1 }` (all optional; the flags must be booleans; `groupId` may be `null`). `400` for an unknown group, `409` if it would demote the last user who can manage users.

### Delete User
- **URL:** `/user/:id`
- **Method:** `DELETE`
- `409` when deleting the last user who can manage users.

### User Avatar
- **Get:** `GET /user/:id/avatar?v=<avatar>` — no authentication (the login screen shows it). 256×256 WebP; `404` when the user has none. Cached indefinitely when `v` matches the current `avatar`.
- **Upload:** `PUT /user/:id/avatar` — multipart with one image file; cropped to a square. Returns the updated user. `400` without a file, `422` if it is not an image.
- **Remove:** `DELETE /user/:id/avatar` — returns the updated user.
- Files are stored in `assets.userAvatarLocation` (default `/etc/oblecto/assets/userAvatars/`).

## Account (V1)

The signed-in user's own account. These need a session but no permission. Username, group and the sign-in flags are not editable here; they belong to whoever holds `users.manage`.

The account object is the user object plus:
```json
{
  "hasPassword": true,
  "group": { "id": 2, "name": "Users" },
  "permissions": [],
  "preferences": {
    "language": null,
    "audioLanguage": null,
    "subtitleLanguage": null,
    "subtitleMode": "auto",
    "quality": "original",
    "autoplayNext": true
  }
}
```

`preferences` always carries every key, with defaults filled in:
- `language`: interface language as a BCP 47 tag (`"en"`, `"pt-BR"`); `null` follows the browser.
- `audioLanguage`, `subtitleLanguage`: preferred track languages (ISO 639 code as found in the media, e.g. `"en"` or `"jpn"`); `null` keeps the file's default track.
- `subtitleMode`: `off`, `auto` or `forced`.
- `quality`: `original`, `auto`, `360`, `480`, `720` or `1080`.
- `autoplayNext`: start the next episode when one ends.

The Jellyfin emulation reports these as the user's audio and subtitle language, subtitle mode and next-episode autoplay.

- **Get:** `GET /api/v1/me`
- **Update:** `PATCH /api/v1/me` with any of `{ "name": "...", "email": "...", "preferences": { "subtitleMode": "off" } }`. Preferences are merged, so send only the ones that changed. Empty `name` or `email` clears it. Unknown or invalid preferences return `400` with `{ "error": "Check the highlighted preferences.", "fields": { "quality": "..." } }` and nothing is saved.
- **Change password:** `PUT /api/v1/me/password` with `{ "currentPassword": "...", "newPassword": "..." }`. `currentPassword` may be omitted only when the account has no password. `403` when it is wrong, `400` when the new one is shorter than four characters.
- **Avatar:** `PUT /api/v1/me/avatar` (multipart, one image) and `DELETE /api/v1/me/avatar`, with the same processing and errors as `PUT /user/:id/avatar`.

Each returns the updated account object.

## Clients (Remote Control)

Remote play has no REST surface. `GET /clients` and `POST /client/:clientId/playback` were removed: device discovery, playback commands and playback state all travel over the realtime socket, which is the only transport that can acknowledge a command and stream state back. See [REALTIME_API.md](REALTIME_API.md).

`GET /api/v1/status/clients` remains, as a read-only diagnostic view of the caller's own connected devices.

## Settings & System (V1)

### Configuration
Manage the core application configuration. Settings endpoints need `settings.manage`; library mutations need `libraries.manage`; maintenance and imports need `system.manage` (see [Permissions and groups](#permissions-and-groups)). Reading library paths, system info and capabilities only needs a session.

Configuration and library mutations are serialized and persisted by atomic file replacement before success is returned. A failed write leaves the active configuration unchanged and returns an error. Object sections use shallow field merging; send the complete nested width object when changing artwork sizes. Unchanged fields should be omitted. Masked `***` credential values in object sections are treated as unchanged.

The `authentication` section also carries the login-screen switches: `profilePicker` (show the profile picker on the local network, default on), `localPasswordlessLogin` (allow opted-in users to sign in without a password on the local network), `localSubnets` (extra CIDRs counted as local) and `trustProxy` (believe `X-Forwarded-For`). `allowPasswordlessLogin` now only applies on the local network.

Invalid settings return HTTP 400 with `{ "error": "Check the highlighted settings.", "fields": { "artwork.poster.small": "Enter a positive whole number of pixels." } }`. No part of an invalid request is applied. Artwork widths must be positive integers; paths must be non-empty and contain no null characters (relative paths remain supported); federation ports must be integers from 1 through 65535. Provider keys must be strings.

- **Get Full Config:** `GET /api/v1/settings`
- **Update Config:** `PATCH /api/v1/settings`
  - **Body:** JSON object with configuration sections to update (e.g., `{ "server": { "port": 8080 } }`).
- **Get Section:** `GET /api/v1/settings/:section`
- **Update Section:** `PATCH /api/v1/settings/:section`
  - **Body:** JSON object for the section.

### Metadata provider connection tests

- **Test saved credentials:** `POST /api/v1/settings/providers/:provider/test`
- **Provider:** `themoviedb`, `tvdb`, or `fanart.tv`; unknown providers return HTTP 400.
- **Body:** None. Uses the saved key, never changes configuration, and does not require a server restart to test.
- **Response:** `{ "ok": true, "code": "connected", "message": "Connection successful using the saved key." }`.
- **Failure codes:** `missing_key`, `invalid_key`, `rate_limited`, `timeout`, `provider_error`, or `service_error`, with `ok: false` and an actionable message. Provider failures use HTTP 200; transport/authentication failures of the Oblecto request use the normal HTTP error handling.
- Requests time out after eight seconds. Responses contain no keys, access tokens, or raw upstream errors. Tests use the API generations used by the installed metadata clients. Metadata clients cache credentials, so saved key changes require a server restart for indexing.
- Reference: [TMDB authentication](https://developer.themoviedb.org/reference/authentication-validate-key), [Fanart.tv v3 API](https://fanart.tv/api-docs/api-v3/), and the installed `node-tvdb` client’s legacy login endpoint.

### Library Management
Manage media libraries and sources. Mutations follow the same persistence guarantees as configuration updates. Source paths must be non-empty strings without null characters.

- **List Libraries:** `GET /api/v1/libraries`
- **Get Library Paths:** `GET /api/v1/libraries/:type` (`movies` | `tvshows`)
  - **Response:** Array of directory objects (e.g., `[{ "path": "/path/to/media" }]`).
- **Update Library Config:** `PATCH /api/v1/libraries/:type`
- **Add Source Path:** `POST /api/v1/libraries/:type/paths`
  - **Body:** `{ "path": "/path/to/media" }`
- **Remove Source Path:** `DELETE /api/v1/libraries/:type/paths`
  - **Body:** `{ "path": "/path/to/media" }`

### System Maintenance

- **Trigger task:** `POST /api/v1/system/maintenance`
- **Body:** `{ "action": "scan", "target": "movies" }`.
- **Response:** `{ "success": true, "message": "Maintenance job accepted", "job": { ... } }`. Repeating an active action/target returns its existing job. `tvshows` aliases `series` for scans/artwork.
- **List jobs:** `GET /api/v1/system/maintenance/jobs` returns an array of job records, newest first.

| Action | Supported targets |
| --- | --- |
| `scan` | `all`, `movies`, `series`, `tvshows` |
| `update_artwork` | `all`, `movies`, `series`, `tvshows` |
| `update_metadata` | `all`, `movies`, `series`, `episodes`, `files`, `tvshows` (series and episodes) |
| `clean` | `all`, `movies`, `series`, `episodes`, `files`, `tvshows` (episodes, empty series, and pathless series) |

Unsupported combinations return HTTP 400. Individual `clean/series` removes empty series; `clean/episodes` removes episodes without linked files. Scans use the configured re-index behavior rather than forcing re-identification.

A job record contains `id`, `action`, `target`, `state` (`queued`, `running`, `completed`, `failed`), ISO `createdAt`, optional ISO `finishedAt`, `discovering`, `total`, `completed`, `failed`, and optional safe `error`. Counts track queued tasks, including descendants; a failed collection contributes a failed task. Totals can grow during discovery and descendant processing. Completion means collection and all associated tasks have settled, regardless of unrelated queue activity.

History holds active jobs and the latest 100 finished jobs in memory. It survives page reloads and resets on server restart. There is no job cancellation or database migration. Clients may poll every two seconds while visible and should mark retained data as stale when requests fail.

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

### Media detail metadata and related titles

Movie, series, and episode metadata includes nullable `siteRatingSource` (`tmdb`,
`tvdb`, or `null`) alongside `siteRating` and `siteRatingCount`. Scores and counts
are refreshed together from a single provider. Existing scores have unknown
provenance until refreshed; clients should label unknown sources “Community
rating.” A missing count is `null`, not a count from a different provider.
Automatic metadata refreshes preserve existing scalar values when a provider
omits them. Optional credit and external-ID failures do not discard successful
core metadata; failed or malformed credit responses preserve existing credits.

`GET /movie/:id/related` and `GET /series/:id/related` require authentication and
return `{ "items": [...] }` using media model/card fields, with at most 12 titles
of the same media type already in the library. Ranking is shared public
collections, shared credited people, then shared genres, each descending;
ties use title then ID ascending. Results contain no ranking internals or
other users’ watch histories. Every item includes `relationship` with capped
`sharedCollections`, `sharedPeople`, and `sharedGenres` arrays; movie items also
include the requesting user's `TrackMovies` entry when present. The current title is excluded. Movie collection
members are excluded because the movie detail collection shelves already show
them. Private collections do not contribute to ranking. Unknown titles return
404; no matches return an empty `items` array. No external catalog is queried.

`GET /series/:id/fanart` serves series landscape artwork and accepts the same
`size` parameter as movie fanart (default `large`). Like other artwork routes,
it is public for image clients. Unknown titles or unavailable image files return
404. Clients should fall back to the series poster, then a plain background.
Originals and resized variants use `assets.showFanartLocation` (default
`/etc/oblecto/assets/showFanart/`) and existing `artwork.fanart` sizes. Missing
artwork is collected on new-series indexing and normal artwork maintenance.
