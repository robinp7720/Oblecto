# Oblecto API reference

The native Oblecto API supports desktop, mobile and web clients: authentication, browsing, personal lists, playback, progress, remote control and administration. This reference describes this checkout, including unreleased features. The package version alone does not guarantee that an older installation implements every route here.

Start with the [desktop client implementation guide](DESKTOP_CLIENTS.md) for an end-to-end workflow. Use the [complete endpoint index](API_ENDPOINTS.md) for methods, permissions, inputs and success responses, and the [response models](API_MODELS.md) when implementing decoders. [Realtime events](REALTIME_API.md), [streaming operations](STREAMING.md), [federation](FEDERATION.md) and [Jellyfin compatibility](JELLYFIN.md) have separate references.

## Contents

- [Transport and conventions](#transport-and-conventions), [authentication](#authentication)
- [Movies](#movies), [series](#tv-shows-series), [episodes](#episodes), [sets](#sets), [people](#people-and-credits)
- [Streaming](#streaming), [users](#users), [account](#account-v1), [remote control](#clients-remote-control)
- [Settings and system](#settings--system-v1), [status](#status-v1), [files](#files)
- [Federation administration](#federation-administration), [playback markers](#file-playback-markers), [statistics](#statistics)

## Base URL
All API endpoints are relative to the server root. Typically this is `http://<server-ip>:<port>`.

When `web.enabled` is on, `/` redirects to `/web/`, which serves the web app, and `/web/logo.png` serves Oblecto's logo. Neither needs a session.

## Transport and conventions

- Native HTTP and Socket.IO use `server.port` (default **8080**). Paths such as `/movies/list/movieName` are at the root; do not prepend `/api/v1`. Only explicitly versioned routes have that prefix. `/web/` is the UI, not the API base.
- The optional Jellyfin server uses `jellyfin.port` (default **8096**) and separate tokens, IDs and endpoints. Native clients should use the native API throughout.
- Send `Accept: application/json`, `Content-Type: application/json` for JSON bodies, and `Authorization: Bearer <accessToken>` on protected calls. No cookie, API key registration, CSRF token or OAuth flow is required. `API-Token` is not an alternative authentication header, despite appearing in the CORS allowlist.
- Send read filters in the query string and writes in the body. URL-encode path segments and query values, especially search strings and opaque cursors. JSON booleans and playback numbers must not be strings.
- Success is **200** unless documented otherwise. **204** has no body. Collections generally return arrays; browse and statistics have their own envelopes. There is no common `{ data: ... }` wrapper or universal total count.
- Media, person, file, set and user IDs are database integers in separate namespaces. Playback session IDs are opaque strings. Remote `media.id` is a string representation of a native movie/episode ID. Store IDs with the server address and media kind.
- Metadata is often nullable and associations vary by endpoint. Ignore unknown fields and tolerate absent optional associations. Capitalization such as `Files`, `Streams`, `SeriesId` and `TrackEpisodes` is significant. See [models and units](API_MODELS.md).
- Express also serves HEAD for GET routes. Playback media explicitly supports HEAD and byte ranges. Do not use HEAD as a session heartbeat.

### Errors and retries

The HTTP status is authoritative. Error bodies vary:

```json
{ "code": 401, "message": "Your session has expired. Please sign in again." }
```

```json
{ "code": "STALE_REVISION", "message": "Playback session has changed" }
```

```json
{ "error": "Check the highlighted preferences.", "fields": { "quality": "Choose one of original, auto, 240, 360, 480, 720, 1080." } }
```

Some handlers return only `{ "message": "..." }` or `{ "error": "..." }`. Unknown routes, middleware errors and proxy failures can return non-JSON or empty bodies. Read defensively; display `message`, then `error`, then an HTTP-status fallback. Some legacy lookups return empty 200 bodies for absent records; see the endpoint index.

| Status | Client action |
| --- | --- |
| 400 | Correct input; surface `fields` beside controls when supplied. |
| 401 | For API/control requests, sign in again. For media, check the playback session; its token is separate. |
| 403 | Disable the unauthorized operation; refresh `/api/v1/me` permissions. |
| 404 | Handle an absent item/session. Recreate an expired session from the last local position. |
| 409 | Resolve the conflict; for playback read the current descriptor and serialize changes. |
| 410 | A retried problematic file was removed because it no longer exists. Refresh the list. |
| 413 / 422 | Reduce an upload, correct the image, or choose supported playback options/source. |
| 416 | Correct the byte range. |
| 429 | Honor login `Retry-After` seconds; avoid password retry loops. |
| 499 | Playback work was cancelled; discard work for an obsolete player generation. |
| 500 / 502 / 503 / 504 | Show a recoverable server/peer error and bound retries. `SERVER_CAPACITY` includes `Retry-After: 2`. |

GETs may be retried with backoff. There is no idempotency-key mechanism for POST. After an uncertain session creation, avoid a create loop: each success allocates a separate session. Stop sessions whose IDs are known. User-state PUTs are idempotent.

### Desktop transport and CORS

The HTTP listener is plain HTTP; HTTPS can be supplied by a reverse proxy. Preserve the configured base URL, including any deployment prefix, and map root-relative returned media paths through that prefix. Socket.IO needs the corresponding `/socket.io/` path exposed by the proxy.

Browser/Electron renderer fetches need their exact origin in `server.corsOrigins` (default `[]`); native HTTP clients are not subject to browser CORS. REST allows `Authorization`, `Content-Type` and `Range`, and exposes range/length headers. It does **not** currently expose `Retry-After` to cross-origin browser JavaScript. Socket.IO has a separate permissive origin policy and still requires handshake authentication.

### Image uploads

Image PUTs use `multipart/form-data` with **one file**, at most **25 MiB**. The field name is arbitrary (`file` is convenient); let the HTTP library create the boundary. Missing file: 400; oversized file: 413; undecodable image: 422. Poster height/width must be 1–2; fanart and episode banner height/width must be 0.4–0.8 (422 otherwise). Library artwork is re-encoded as JPEG; resized variants are queued and may not be ready immediately. Library artwork PUTs return `["success"]`. Avatar PUTs crop to 256×256 WebP and return a user/account.

Artwork GETs are public. Library artwork supports `size=small|medium|large|original`; posters and banners default to `medium`, fanart to `large`. Person profiles use `small|medium|large`, default `medium`; unknown profile sizes fall back to `medium`. Missing images need a placeholder. There is no native media-file upload or download-management endpoint.

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
  - Repeated failed sign-ins return `429` with `Retry-After` seconds.

### Token lifecycle

Access tokens are signed JWTs with a default lifetime of 30 days (`authentication.tokenLifetimeDays`). Login returns only `accessToken`, without a refresh token. Tokens survive restarts while the signing secret and credentials remain unchanged. Expiry, user deletion, password change/removal or signing-secret change invalidate them. There is no native refresh, logout, token-revocation or self-registration endpoint.

Use `GET /api/v1/me` after login and on app restoration for current identity, preferences and permissions. JWT name/email claims are issuance-time snapshots. A successful password change returns the account but **does not issue a replacement token**: sign in again. On local sign-out, stop playback sessions, disconnect realtime, and clear tokens and user-specific caches. Store desktop credentials in the operating system credential store.

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
- **Notes:** `users` holds users with `publicProfile` and is only populated for clients on the local network when `authentication.profilePicker` is on (off by default); it never includes emails. `passwordless` means `POST /auth/login` with just `userId` will succeed.

### Local network
A client is local when its address is loopback, private (10/8, 172.16/12, 192.168/16, fc00::/7) or link-local, or falls in one of `authentication.localSubnets` (CIDRs). The TCP peer address is used; `X-Forwarded-For` is only honoured when `authentication.trustProxy` is on, so enable that only behind a reverse proxy that sets it.

### Permissions and groups
Every user belongs to at most one group, and a group grants a fixed set of permissions. Signing in, browsing, playback and managing your own account need none. Endpoints that need a permission answer `403` without it (and `401` without a valid token, or when the token's user has been deleted). Permissions are looked up on every request, so moving someone to another group applies to tokens they already hold.

| Permission | Grants |
|---|---|
| `settings.manage` | All of `/api/v1/settings` and `/api/v1/federation` (reading included) |
| `users.manage` | `/users`, creating, editing and deleting users, other users' avatars, and `/api/v1/groups` |
| `libraries.manage` | Library path and indexer changes, creating/deleting sets, set membership, artwork uploads, file problem management and segment overrides. Reading `/files/:id/markers` only needs a session. |
| `system.manage` | Maintenance jobs, remote imports and seedbox status |
| `statistics.view` | Server-wide viewing history, library inventory and playback-health statistics |

Two built-in groups exist and are recreated if missing: **Administrators** (every permission) and **Users** (none). New users join **Users** unless told otherwise. Built-in groups cannot be renamed or deleted, and Administrators always keeps `users.manage`. Any change that would leave nobody holding `users.manage` (deleting or moving the last such user, or taking the permission away from their group) is refused with `409`.

The first administrator is chosen on the server: `oblecto usergroup USERNAME Administrators`. Until someone is, the server logs a warning at startup.

- **List permissions:** `GET /api/v1/permissions` → `[{ "key": "settings.manage", "description": "..." }]`
- **List groups:** `GET /api/v1/groups` → `[{ "id": 1, "name": "Administrators", "permissions": ["settings.manage", ...], "builtIn": true, "members": 1 }]`
- **Create group:** `POST /api/v1/groups` with `{ "name": "Family", "permissions": ["libraries.manage"] }`. `400` for an empty name or unknown permission, `409` if the name is taken.
- **Update group:** `PATCH /api/v1/groups/:id` with `name` and/or `permissions` (the full list).
- **Delete group:** `DELETE /api/v1/groups/:id`. Members move to **Users**.

All group endpoints and `GET /api/v1/permissions` require `users.manage`. Create/update return the group with member count (HTTP 200); delete returns `{ "id": 3 }`. Ordinary clients get effective permissions from `/api/v1/me`.

## Movies

### List Movies
Get a paginated list of movies.

- **URL:** `/movies/list/:sorting`
- **Method:** `GET`
- **URL Params:**
  - `sorting`: Field to sort by. In the plain form any movie column (e.g. `movieName`, `releaseDate`, `createdAt`); in the browse form one of `movieName`, `releaseDate`, `createdAt`, `updatedAt`, `popularity`, `runtime`.
- **Query Params:**
  - `order`: `asc` or `desc`. Required in the plain form; the browse form defaults to `asc`.
  - `count`: Number of items per page (default: `20`).
  - `page`: Page number (0-indexed, default: `0`).
- **Response:** Array of Movie objects, each with the user's `TrackMovies` entry.

#### Browse form
Send `mode=browse` to filter and page with a cursor. The same parameters work for `GET /series/list/:sorting`, whose sort fields are `seriesName`, `firstAired`, `createdAt`, `updatedAt`, `siteRating`, `siteRatingCount` and `popularity`.

- `count`: 1–100 (default `20`).
- `cursor`: `pageInfo.nextCursor` from the previous page. A cursor only works with the sort, order and filters it came from; anything else returns 400.
- `q`: title search. `genre`: one or more genres, repeated or comma-separated.
- `yearFrom`, `yearTo`: release or first-aired year range.
- `watched`: `all` (default), `watched` (90% or more), `inprogress` or `unwatched`.
- `list`: `all` (default), `favourites`, or `watchlist`. Saved lists are private to the authenticated user and apply to movies and series in browse mode. List selection participates in cursor validation and combines with the other filters.
- `libraryPath`: only titles whose files are under this library folder.
- `personId`, `creditRole`: see [Filter Libraries by Person](#filter-libraries-by-person).

Invalid filters, sorts and cursors return 400 with `{ "message": "..." }`; `count` is clamped to 1–100. Browse uses `cursor`, not `page` (which is ignored). The response is:

```json
{
  "items": [{ "id": 42, "movieName": "Example Movie", "TrackMovies": [] }],
  "pageInfo": { "hasNextPage": true, "nextCursor": "eyJzb3J0Ijo...", "count": 1 },
  "appliedFilters": { "q": null, "genre": [], "yearFrom": null, "yearTo": null, "watched": "all", "list": "all", "libraryPath": null, "personId": null, "creditRole": "any" },
  "facets": { "genres": ["Drama"], "years": [2024] }
}
```

The example shows a one-item page with abbreviated movie fields and an illustrative opaque cursor. `facets` lists genres and years matching all active filters, before cursor paging. Multiple genres are ORed; other filter categories combine with AND. `pageInfo.count` is the number returned, not a total; `nextCursor` is null at the end. Reset cursors after changing filters, sort, order, server or user. These are live queries, not snapshots; deduplicate by ID when refreshing during library changes.

Browse facets are aggregated in the database and cached for up to 30 seconds per database, signed-in user and filter set. Cursor, sort and page-size changes reuse those facets. Catalogue changes invalidate affected entries; watched and saved-list filters also invalidate after relevant user-state writes, including transaction commits. External database writes become visible when the cache expires. The response envelope and filtering rules are unchanged.

Movie watch filters use progress >= 0.9 for `watched`, 0 < progress < 0.9 for `inprogress`, and missing/zero progress for `unwatched`. For series, `watched` means **at least one** episode is watched, `inprogress` means at least one is partially watched, and `unwatched` means none has positive progress. A series can match both watched and in-progress queries. Series browse items have no aggregate tracking; fetch `/series/:id/episodes` to compute completion.

### Get Movie Info
Retrieve detailed information about a specific movie.

- **URL:** `/movie/:id/info`
- **Method:** `GET`
- **Authentication:** Required.
- **Response:** Movie details, files and streams, watch progress, audience score fields, and `credits.cast` / `credits.crew` arrays containing linked people and roles. Every credit includes `libraryConnections: { movies, series }`, counting other top-level titles featuring that person. `userState: { favourite: boolean, watchlist: boolean }` belongs only to the caller. `trailers`, `certifications`, `trailersUpdatedAt` and `certificationsUpdatedAt` contain the last cached extras (nullable); this endpoint itself makes no provider requests.

### Save a Movie

These endpoints require authentication and always act on the signed-in user; a supplied user ID cannot change another user's list. Operations are idempotent. Unknown movies return 404, and a missing or non-boolean flag returns 400 with `{ "message": "..." }`.

| Method and URL | JSON body | Response |
|---|---|---|
| `PUT /movie/:id/favourite` | `{ "favourite": true }` | `{ "favourite": true }` |
| `PUT /movie/:id/watchlist` | `{ "watchlist": true }` | `{ "watchlist": true }` |

Set the flag to `false` to remove the movie. Favourites share the existing Jellyfin favourite storage and notifications. Watchlists are independent of favourites and watched state; watching a movie does not remove it. Browse saved movies with `GET /movies/list/movieName?mode=browse&list=watchlist&order=asc` (or `list=favourites`).

### Get Movie Trailers and Certifications

- **URL:** `/movie/:id/extras`
- **Method:** `GET`
- **Authentication:** Required. Unknown movies return 404.
- **Response:** `{ "trailers": [...], "certifications": [...], "unavailable": false }`.
- Each trailer has `{ "name": "Official trailer", "site": "YouTube", "key": "...", "language": "en", "official": true }`. Only trailers with valid YouTube or Vimeo identifiers are returned; official trailers are ordered first. `language` may be null. No video content is proxied.
- Each certification has `{ "country": "US", "certification": "PG-13" }`. There is at most one classification per country: theatrical, then limited theatrical, then other release types, using the earliest dated release within a priority. Blank classifications are omitted. Clients should show the country and allow region selection; missing data does not mean unrestricted viewing.

Each list is refreshed from TMDB independently after seven days. Concurrent requests for one movie share the provider work. Empty successful lists are cached too. Provider failures or malformed responses preserve the previous cached field and its timestamp, and set `unavailable: true`; callers can retry this endpoint. Movies without a TMDB ID return empty lists without a provider request. Database errors still use the normal API error response. The web page loads these extras separately so playback and core details remain usable during provider failures.

### Set Movie Watched State
- **URL:** `/movie/:id/watched`
- **Method:** `PUT`
- **Body:** `{ "watched": true }`
- **Response:** `{ "watched": true, "track": { "time": 0, "progress": 1, "updatedAt": "..." } }`. Setting `watched` to false clears the resume position and writes progress `0`.

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
- **Add Movie to Set:** `PUT /movie/:id/sets` (Body: `{ "setId": 1 }`; needs `libraries.manage`)

Creating and deleting sets is under [Sets](#sets). Reads show public sets and private sets shared with the caller.

### Watching (Resume)
Get a list of movies currently being watched.

- **URL:** `/movies/watching`
- **Method:** `GET`
- **Response:** Array of Movie objects.

To play a movie, create a playback session for one of its files; see [Streaming](#streaming).

The resume list includes tracking rows updated in the last seven days with progress below 0.9 (including zero), newest tracking update first. It is not the complete viewing history.

## TV Shows (Series)

### List Series
Get a paginated list of TV shows.

- **URL:** `/series/list/:sorting`
- **Method:** `GET`
- **URL Params:** `sorting` (e.g., `seriesName`).
- **Query Params:** `order`, `count`, `page`, or the [browse form](#browse-form) with `mode=browse`.
- **Response:** Array of Series objects.

### Get Series Info
- **URL:** `/series/:id/info`
- **Method:** `GET`
- **Response:** Series details, caller-specific `userState: { favourite, watchlist }`, cached trailers/certifications and their timestamps, audience score fields, and aggregate `credits.cast` / `credits.crew` arrays. Series credits may include `episodeCount`. Every credit includes `libraryConnections: { movies, series }`, counting other top-level titles featuring that person.

### Series Extras
- **URL:** `/series/:id/extras`
- **Method:** `GET` (authenticated)
- **Response:** `{ trailers: [...], certifications: [{ country: "DE", certification: "12" }], unavailable: boolean }`.
- TMDB trailers and regional TV content ratings are cached for seven days. Concurrent viewers share a refresh; failures preserve cached values. Unidentified shows return empty extras. This endpoint does not fetch or return the episode catalogue.

### Series Library Workspace
- **URL:** `/series/:id/library`
- **Method:** `GET`
- **Authentication:** Requires `libraries.manage`; authenticated viewers without it receive 403.
- **Response:** `{ series: { id, seriesName, tmdbid }, catalogAvailable: boolean, catalogUpdatedAt: string | null, unavailable: boolean, rows: [...] }`.
- Rows contain `{ key, local, catalog, status, reason, special }`. `local` is null or `{ id, tmdbid, tvdbid, airedSeason, airedEpisodeNumber, episodeName, Files: [{ id }] }`; `catalog` is null or `{ tmdbid, season, number, name, airDate, runtime }`. No file paths or watch history are returned.
- Unique TMDB episode IDs establish matches independently of season order. Local numbering is preserved. No season/number or title fallback is used. `matched` requires an exact ID and a playable file. Unknown, duplicate or unmatched local IDs, or a match without files, require `review`. Unresolved local identities prevent definitive absence claims for unmatched catalogue entries.
- Other catalogue entries have `absent` (aired with no matching local ID), `upcoming` (future TMDB date), or `unscheduled` (no date) status. `special` identifies season-zero entries in either source; the management UI excludes them from regular counts. Dates can change; results describe this provider snapshot, not authoritative show completeness.
- Only this management endpoint refreshes the complete episode catalogue (one-day cache). Concurrent requests share the refresh; season requests have bounded concurrency and a 20-second total deadline. Failure sets `unavailable` and preserves the last complete snapshot. Unidentified shows have `catalogAvailable: false`. Catalogue records never create playable episodes. Normal series/list/info responses omit the large `episodeCatalog` cache.

### Series Favourites and Watchlist
Both endpoints require authentication, validate a boolean body (`400` otherwise), and return `404` for an unknown show. They only change the caller's saved list.

| Endpoint | Body | Response |
| --- | --- | --- |
| `PUT /series/:id/favourite` | `{ "favourite": true }` | `{ "favourite": true }` |
| `PUT /series/:id/watchlist` | `{ "watchlist": true }` | `{ "watchlist": true }` |

Use `false` to remove. Favourites share Jellyfin storage. Watchlists remain independent of watched state and favourites. Browse with `/series/list/seriesName?mode=browse&list=watchlist` or `list=favourites`; facets and cursors use the same user-scoped filters.

### List Episodes in Series
- **URL:** `/series/:id/episodes`
- **Method:** `GET`
- **Response:** Array of Episode objects with caller-scoped `TrackEpisodes`, a compact `Series: { id, seriesName }`, and `Files: [{ id, duration }]` for availability and runtime estimates. A metadata-only episode has an empty `Files` array. Aired season/episode values are stored as strings; clients should sort them numerically.

There is no native season-list route: group this array by `airedSeason`, keeping `"0"` as specials. An unknown series returns an empty array.

### Set Season Watched State
- **URL:** `/series/:id/seasons/:season/watched`
- **Method:** `PUT`
- **Body:** `{ "watched": true }`
- **Response:** `{ "watched": true, "episodes": [{ "id": 1, "track": { "time": 0, "progress": 1, "updatedAt": "..." } }] }`. Only episodes with the exact aired-season value are changed.

### Mark Earlier Episodes Watched
- **URL:** `/series/:id/episodes/:episodeId/earlier/watched`
- **Method:** `PUT` (authenticated)
- **Body:** `{ "watched": true }` (only `true` is accepted; otherwise `400`).
- **Response:** The same `{ watched: true, episodes: [{ id, track }] }` envelope as season watch-state changes, including an empty list when there are no earlier episodes.
- Updates only the caller's library episodes before the anchor in numeric aired season/episode order; the anchor is excluded. Regular episodes exclude specials. A special's predecessors are confined to its own season. The anchor must belong to the requested series (`404` otherwise). The native UI confirms the scope before changing multiple episodes.

### Series Sets
- **Get Sets for Series:** `GET /series/:id/sets`. Each set includes its member titles in `Series`.
- **List Sets:** `GET /series/sets`
- **Get Set Details:** `GET /series/set/:id` (supports `count` and `page`)
- **Add Series to Set:** `PUT /series/:id/sets` (Body: `{ "setId": 1 }`; needs `libraries.manage`)

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

### Get Episode Files
- **URL:** `/episode/:id/files`
- **Method:** `GET`
- **Response:** Array of the episode's File objects.

### Get Episode Info
- **URL:** `/episode/:id/info`
- **Method:** `GET`
- **Response:** Episode details, files and streams, runtime, audience score fields, guest cast, and episode crew. Every credit includes `libraryConnections: { movies, series }`, excluding the current parent series.

### Set Episode Watched State
- **URL:** `/episode/:id/watched`
- **Method:** `PUT`
- **Body:** `{ "watched": true }`
- **Response:** `{ "watched": true, "track": { "time": 0, "progress": 1, "updatedAt": "..." } }`. Setting `watched` to false clears the resume position and writes progress `0`.

### Episode Favourite
- **URL:** `/episode/:id/favourite`
- **Method:** `PUT` (authenticated)
- **Body/response:** `{ "favourite": true }`; use `false` to remove. Non-boolean values return `400`; unknown episodes return `404`.
- Favourites are independent of the series and use the existing user-scoped Jellyfin favourite storage. Episode info includes `userState: { favourite: boolean }`.

### Get Episode Context
- **URL:** `/episode/:id/context`
- **Method:** `GET`
- **Response:** `{ previous, next, season }`, where adjacent episode summaries include current-user tracking and `season` contains `number`, `position`, `episodeCount`, `watchedCount`, `runtimeMinutes`, and `averageRating`. Regular episodes cross season boundaries in numeric order; specials remain in their own sequence.

The response also includes `nearby` (up to five local episodes centred on the current season position) and `nextUnwatched` (the next playable local episode with progress below 0.9, or null). Navigation entries include user-scoped tracks and compact file IDs/durations. Counts describe imported library episodes, not the provider's full episode catalogue. Chapter timestamps are already exposed in `Files[].chapters` on episode info; play a chapter by creating a normal playback session with that file ID and chapter `start` position.

### Get Next Episode
Get the next episode in the series relative to the given episode ID.

- **URL:** `/episode/:id/next`
- **Method:** `GET`

Returns a bare episode, without files/tracks, or an empty 200 body at the end. This legacy query compares text season/episode fields; use `/episode/:id/context` for numeric ordering, specials handling and playable `nextUnwatched` navigation.

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

Includes `Series` and tracks updated in the last seven days with progress below 0.9 (including zero). Order is episode metadata `updatedAt` descending, not track timestamp.

### On Deck (Up Next)
Get the next episodes to watch based on watch history.

- **URL:** `/episodes/next`
- **Method:** `GET`

For every series with an episode you finished (over 90% watched) in the last seven days, returns the episode after the furthest one finished, in season and episode order. Series come most recently watched first; a series whose last episode you finished is left out. Each episode includes its `Series` and your `TrackEpisodes` progress.

To play an episode, create a playback session for one of its files; see [Streaming](#streaming).

## Sets

Sets group movies or series into collections. Both kinds need `libraries.manage` to change.

- **Create Movie Set:** `POST /set/movie` with `{ "name": "...", "overview": "...", "public": true }`. Returns the set; an existing visible set with the same name is returned unchanged. `public` must be a boolean, `name` must be non-empty text of at most 255 characters (surrounding whitespace is trimmed), and optional `overview` must be text or null. Invalid input returns HTTP 400. If a matching existing set is private and unshared with the caller, returns HTTP 404 without disclosing its metadata. New sets are shared with their creator in the same transaction as creation.
- **Create Series Set:** `POST /set/series`, with the same body.
- **Delete Set:** `DELETE /set/movie/:id` or `DELETE /set/series/:id` → `{ "success": true }`; `404` for an unknown set.

All native set reads require authentication and show only public sets and private sets shared with the signed-in user. This also applies to users with `libraries.manage`; request parameters cannot override the caller's identity. Movie visibility uses the same rule as Jellyfin collections.

- **List sets:** `GET /movies/sets`, `GET /series/sets` → visible sets.
- **Set contents:** `GET /movies/set/:id`, `GET /series/set/:id` → an array containing the visible set and its movies/series. Hidden and nonexistent set IDs both return `[]`; their contents are not disclosed.
- **Sets containing a title:** `GET /movie/:id/sets`, `GET /series/:id/sets` → only visible memberships.

Existing movie shares in `MovieSetUsers` are preserved. Migration `0011-series-set-sharing` adds `SeriesSetUsers`. Older private series sets have no recorded owner or shares and are therefore hidden until explicitly shared; the migration does not guess ownership or make them public.

Set-content `count`/`page` paginate the outer set query, not its members; use page 0. Movie-set `order` is validated but does not sort members. Sort member arrays locally. Native routes do not edit a set, remove individual members or manage shares.

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
- `quality`: `original` (API default; the web account default is Auto), `auto`, or a height of `240`, `360`, `480`, `720`, or `1080`. Original prefers compatible direct playback, then remux, then adaptive transcoding. Auto explicitly requests adaptive HLS. Fixed height selects the highest available rendition at or below that height.
- `maxBitrate`: total bandwidth ceiling in bits/second, at least 200000. Compatible originals within the ceiling can still be delivered directly. Over-budget sources select adaptive output; rendition budgets include audio and a 10% transport allowance.
- `audioStreamIndex`, `subtitleStreamIndex`: absolute ffprobe stream indexes, or `null` to disable that track. Omission applies language/default/forced selection. Invalid or negative indexes return 400.
- `subtitleMode`: `off`, `auto` (default), or `forced`.
- `forceHls`: request HLS instead of original delivery, including decoder recovery.
- `forceDirect`: deliver the original file bytes over HTTP, regardless of codec/container capabilities. Intended for copied URLs and external players that select and decode embedded tracks themselves. Returns `method: "direct"` and an `original` media URL; no remuxing, transcoding or subtitle extraction occurs. Cannot be combined with `forceHls: true`, adaptive quality, `maxBitrate`, explicit audio/subtitle stream indexes or `subtitleMode: "forced"` (400). Omit it or set it to false for normal negotiation.
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
  "operations": { "video": "encode", "audio": "encode" },
  "mediaUrl": "/playback/media/uuid/1/master.m3u8?token=opaque",
  "selectedTracks": { "audioStreamIndex": 1, "subtitleStreamIndex": null, "subtitleMode": "off" },
  "tracks": [],
  "qualities": [{ "id": "720", "height": 720, "bitrate": 2800000 }],
  "subtitleUrl": null,
  "chapters": [],
  "segments": [],
  "trickplay": null
}
```

`chapters` is an array of `{ "start": 0, "end": 90, "title": "Opening" }` (seconds; title may be null). `segments` contains `{ "type": "intro", "start": 0, "end": 90 }` with types `intro`, `credits`, `recap`, or `preview`. `trickplay` is null or `{ "width": 320, "height": 180, "tileWidth": 10, "tileHeight": 10, "interval": 10, "count": 720, "sheets": ["/playback/media/.../trickplay-0.jpg?token=..."] }`. Resolve sheet URLs against the API base, and use `floor(time / interval)` to choose a thumbnail, clamped to `count - 1`. Each sheet holds `tileWidth * tileHeight` thumbnails, row by row. Pending or remote analysis is represented by empty arrays and null trickplay in the session descriptor.

`operations` describes each output track as `copy`, `encode` or `none`. Public `method` values remain `direct`, `remux` and `transcode`; `remux` can now copy compatible H.264 video while converting only audio to AAC. HLS manifests advertise output CODECS and video/audio bandwidth with transport allowance.

Descriptors also include `timings`, with millisecond values for `lookupMs` (authentication/file lookup in the native creation handler), `statisticsMs`, `probeMs`, `planMs`, and `preparationMs` (total time to a prepared session). `probeMs` and `planMs` include waiting for preparation capacity or shared work. `firstMediaMs` is elapsed time from creation handling to the first successful original-file/segment byte; manifests, HEAD requests and failed requests do not set it. `firstPlaybackMs` is the browser's reported time from its play action to its first `playing` event. Both start as null. Server and browser measurements use their own monotonic clocks; do not add them together. Other clients begin server timing at the playback service call; remote preparation is included in `preparationMs` without local probe/plan phases. These timings are transient session diagnostics, not persisted viewing-history fields.

`method` is `direct`, `remux`, or `transcode`. `tracks` contains probed audio/subtitle metadata, including indexes, codecs, language tags and dispositions. Quality bitrates describe video; transcoded audio adds 128 kbps. `subtitleUrl` points to WebVTT when a separate text track is selected. ASS/SSA and bitmap subtitles are rendered into video when required.

PATCH accepts the creation options except `fileId`, plus the current integer `revision`. Successful reconfiguration increments the revision and returns replacement URLs. Reject obsolete responses in clients; old stream URLs return 409. Thumbnail sheet URLs remain usable across revisions of the same active session. Create a new session to change files. Supplying `subtitleMode` without an explicit subtitle index reapplies language/default/forced selection. Explicitly pass `forceHls: false` to return to original playback after fallback.

Progress body: `{ "revision": 1, "position": 123.5, "paused": false, "buffering": false }`. Send every ten seconds and on pause, seek completion, stop, and end. Send the final progress update before deleting the session. Progress is saved using existing movie/episode tracking records; stale revisions return 409. Positions beyond duration plus one second are rejected.

Optional telemetry: `sequence` (increasing nonnegative safe integer), `activeSeconds` (cumulative active wall-clock seconds), `playedRanges` (cumulative `[start,end]` media-second pairs, at most 1024), `playbackRate` (positive, up to 16 for estimated accounting), and `failed` (boolean). Send the first three together for reported watch time; keep counters across revisions, resetting on a new session. Exclude pause, seek and buffering time. Malformed/stale statistics telemetry is ignored independently of resume persistence: `sequence` does not protect resume position from out-of-order HTTP requests. Serialize progress sends. See [statistics](#statistics). Optional `bufferedSeconds` reports finite buffered media ahead of the position (0 to media duration). Optional `rebufferDurationMs` reports cumulative milliseconds stalled after first playback, excluding seeks and intentional pauses; finite monotonic values up to seven days are retained in session diagnostics. These fields do not change watch-time accounting. The optional `firstPlaybackMs` field reports browser startup in milliseconds, including metadata loading and deferred player loading. The first finite nonnegative value up to 86,400,000 is retained for the session; later values and invalid values are ignored, independently of resume persistence.

Playback options are not populated automatically from account preferences. Apply saved quality/subtitle mode and map preferred languages to source stream indexes. Omitted indexes use the server's configured target language, then default/first-track selection. Numeric quality is a number (`720`), not a string. On every PATCH send current absolute `position` explicitly; omission may reuse an earlier creation/reconfiguration position. PATCH configures output; it does not start, pause or seek the local player.

### Media delivery

`GET`/`HEAD /playback/media/:id/:revision/:asset` requires the session-scoped `token` query parameter. Use the returned URLs rather than constructing them. Tokens are revoked on deletion, server restart, or idle expiry (30 minutes by default). They grant access to that session's assets, not control operations or other sessions.

Original delivery supports concurrent single byte ranges, suffix ranges, HEAD, 206 and 416 responses. HEAD returns full-resource headers with 200 and ignores Range. Multiple ranges are rejected with 416; unsatisfiable ranges include `Content-Range: bytes */<size>`. HLS provides full-duration VOD manifests with on-demand segments, enabling arbitrary seeking without creating another session. All advertised segment URLs remain regenerable after cache eviction. No indexing-time preprocessing is required.

To obtain a direct HTTP file link, create a session with `{ "fileId": 123, "forceDirect": true }`, resolve its returned `mediaUrl` against the server base URL, and open it in an external player. The URL includes its media token, so playback does not need an Authorization header. The player must support the source container and codecs. These links have the same session expiry and revocation rules as other media URLs.

Progress, successful reconfiguration and media access refresh the idle lease. Paused clients should continue heartbeats if they want to retain a session. Session state and URLs are ephemeral; saved watch progress survives restart. `GET` descriptors do not refresh the lease.

Errors use `{ "code": "INVALID_SELECTION", "message": "..." }`: invalid options (400), invalid media token (401), unavailable/foreign session or file (404), stale revision (409), unsupported media (422), unsatisfiable range (416), capacity/storage/encoder failures (503), preparation timeout (504). Capacity responses include `Retry-After: 2`. Once response headers are sent, transport failures close that response.

Recognized playback codes include `INVALID_SELECTION`, `UNAUTHORIZED`, `SESSION_EXPIRED`, `MEDIA_NOT_FOUND`, `STALE_REVISION`, `UNSUPPORTED_MEDIA`, `INVALID_RANGE`, `SERVER_CAPACITY`, `REMOTE_UNAVAILABLE` (502/503), `REMOTE_TIMEOUT` (504), `ENCODER_UNAVAILABLE`, `ENCODING_FAILED`, `STORAGE_FULL`, `ENCODING_TIMEOUT`, and `CANCELLED` (499, or 503 during shutdown). Keep a fallback for unknown codes and for ordinary numeric-code authentication errors.

### Breaking migration

The old `/session/create/:id`, `/session/stream/:id`, and `/HLS/:id/segment/:segment` contracts are removed. Replace codec CSV lists and `noremux` with capabilities and quality preferences. Replace `seeking`, `inputCodec`, and `outputCodec` response handling with the new descriptor. Replace `-1` track sentinels with `null`. Update backend and bundled web/client-library submodules together; restart discards active sessions but retains library and watch-progress data.

Federation media peers must both support protocol version 1; older peers are rejected. Metadata synchronization requires protocol version 2 on both peers; see [federation setup and operations](FEDERATION.md). See [streaming operations and testing](STREAMING.md).

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
- `username`, `email` and `name` are required. Password is optional, but remote sign-in still requires one. Returns the public user with HTTP 200; an existing username returns its existing user unchanged.

### Update User
- **URL:** `/user/:id`
- **Method:** `PUT`
- **Body:** `{ "username": "...", "password": "...", "email": "...", "name": "...", "publicProfile": true, "passwordlessLocal": false, "groupId": 1 }` (all optional; send flags as booleans; `groupId` may be `null`). Non-boolean flags and empty text/password values are ignored by this legacy update route. `400` for an unknown user/group, `409` if it would demote the last user who can manage users. Returns the public user.

### Delete User
- **URL:** `/user/:id`
- **Method:** `DELETE`
- `409` when deleting the last user who can manage users.
- Returns the deleted public user record with HTTP 200; an unknown ID returns 404.

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
    "autoplayNext": true,
    "stillWatchingPrompt": true,
    "episodeSpoilers": "off"
  }
}
```

`preferences` always carries every key, with defaults filled in:
- `language`: interface language as a BCP 47 tag (`"en"`, `"pt-BR"`); `null` follows the browser.
- `audioLanguage`, `subtitleLanguage`: preferred track languages (ISO 639 code as found in the media, e.g. `"en"` or `"jpn"`); `null` leaves selection to the playback defaults. Native clients map non-null preferences to stream indexes themselves.
- `subtitleMode`: `off`, `auto` or `forced`.
- `quality`: `original`, `auto`, `240`, `360`, `480`, `720` or `1080`; unset account preferences default to `auto`, preserving explicitly saved choices.
- `autoplayNext`: start the next episode when one ends.
- `episodeSpoilers`: `off` (default), `hide` (hide unwatched episode artwork/synopsis), or `hide-titles` (also hide titles). This native-web presentation preference applies to pages, cards, catalogue titles, adjacent previews and chapter titles. Progress of at least 0.9 counts as watched. Individual reveals are temporary and reset on navigation/reload; this is not an API access restriction.
- `stillWatchingPrompt`: boolean, default `true`. The default web player finishes the current episode and asks before automatic continuation after 90 minutes without interaction.

The Jellyfin emulation reports these as the user's audio and subtitle language, subtitle mode and next-episode autoplay.

- **Get:** `GET /api/v1/me`
- **Update:** `PATCH /api/v1/me` with any of `{ "name": "...", "email": "...", "preferences": { "subtitleMode": "off" } }`. Preferences are merged, so send only the ones that changed. Empty `name` or `email` clears it. Unknown or invalid preferences return `400` with `{ "error": "Check the highlighted preferences.", "fields": { "quality": "..." } }` and nothing is saved.
- **Change password:** `PUT /api/v1/me/password` with `{ "currentPassword": "...", "newPassword": "..." }`. `currentPassword` may be omitted only when the account has no password. `403` when it is wrong, `400` when the new one is shorter than four characters.
- **Avatar:** `PUT /api/v1/me/avatar` (multipart, one image) and `DELETE /api/v1/me/avatar`, with the same processing and errors as `PUT /user/:id/avatar`.

Each returns the updated account object (GET returns the current account). Password change invalidates the caller's token without returning a replacement; sign in again.

## Clients (Remote Control)

Remote play has no REST surface. `GET /clients` and `POST /client/:clientId/playback` were removed: device discovery, playback commands and playback state all travel over the realtime socket, which is the only transport that can acknowledge a command and stream state back. See [REALTIME_API.md](REALTIME_API.md).

`GET /api/v1/status/clients` remains, as a read-only diagnostic view of the caller's own connected devices.

## Settings & System (V1)

### Configuration
Manage the core application configuration. Settings endpoints need `settings.manage`; library mutations need `libraries.manage`; maintenance and imports need `system.manage` (see [Permissions and groups](#permissions-and-groups)). Reading library paths, system info and capabilities only needs a session.

Configuration and library mutations are serialized and persisted by atomic file replacement before success is returned. A failed write leaves the active configuration unchanged and returns an error. Object sections use shallow field merging; send the complete nested width object when changing artwork sizes. Unchanged fields should be omitted. Masked `***` credential values in object sections are treated as unchanged.

Allowed sections: `indexer`, `cleaner`, `queue`, `tvdb`, `themoviedb`, `fanart.tv`, `assets`, `server`, `jellyfin`, `files`, `artwork`, `fileExtensions`, `transcoding`, `web`, `streaming`, `authentication`, `federation`, `logging`, `seedboxes`, `movies`, `tvshows`. The value types/defaults are in [res/config.json](../res/config.json) and [IConfig](../src/interfaces/config.ts). `seedboxes` is an array replaced as a whole; object sections merge fields. Unknown sections/fields and empty updates return 400. Successful PATCH returns the updated configuration or section, not a restart/completion receipt. Port, provider-client and other startup-bound changes may need a server restart; there is no native restart endpoint.

The full-config response masks the authentication secret, federation private-key path and seedbox passwords. Section reads mask authentication/federation secrets, but not all section credentials (notably seedboxes/provider keys). Treat every configuration response as sensitive and never use it for public discovery or logs. Do not assume `***` inside an array element is preserved by the object-section merge rule.

The `authentication` section also carries the login-screen switches: `profilePicker` (show the profile picker on the local network, default off), `localPasswordlessLogin` (allow opted-in users to sign in without a password on the local network), `localSubnets` (extra CIDRs counted as local) and `trustProxy` (believe `X-Forwarded-For`). `allowPasswordlessLogin` now only applies on the local network.

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
  - **Response:** `{ "movies": { ... }, "tvshows": { ... } }`, the complete library configuration sections.
- **Get Library Paths:** `GET /api/v1/libraries/:type` (`movies` | `tvshows`)
  - **Response:** Array of directory objects (e.g., `[{ "path": "/path/to/media" }]`).
- **Update Library Config:** `PATCH /api/v1/libraries/:type`
  - **Body:** Nonempty partial library configuration, such as `{ "directories": [{ "path": "/media/Movies" }] }`. Returns the updated library section.
- **Add Source Path:** `POST /api/v1/libraries/:type/paths`
  - **Body:** `{ "path": "/path/to/media" }`
- **Remove Source Path:** `DELETE /api/v1/libraries/:type/paths`
  - **Body:** `{ "path": "/path/to/media" }`

Path add/remove return the updated directory array; duplicate addition returns 409 and unknown removal 404. These are server paths. Removing a source changes configuration; it is not a command to delete media bytes.

### System Maintenance

- **Trigger task:** `POST /api/v1/system/maintenance`
- **Body:** `{ "action": "scan", "target": "movies" }`.
- **Response (200):** `{ "success": true, "message": "Maintenance job accepted", "job": { ... } }`. Acceptance does not mean completion. Repeating an active action/target returns its existing job. `tvshows` aliases `series` for scans, artwork and playback analysis.
- **List jobs:** `GET /api/v1/system/maintenance/jobs` returns an array of job records, newest first.

| Action | Supported targets |
| --- | --- |
| `analyse` | `all`, `movies`, `series` (`tvshows` alias) |
| `scan` | `all`, `movies`, `series`, `tvshows` |
| `update_artwork` | `all`, `movies`, `series`, `tvshows` |
| `update_metadata` | `all`, `movies`, `series`, `episodes`, `files`, `tvshows` (series and episodes) |
| `clean` | `all`, `movies`, `series`, `episodes`, `files`, `tvshows` (episodes, empty series, and pathless series) |

Unsupported combinations return HTTP 400. Individual `clean/series` removes empty series; `clean/episodes` removes episodes without linked files. Scans use the configured re-index behavior rather than forcing re-identification.

A job record contains `id`, `action`, `target`, `state` (`queued`, `running`, `completed`, `failed`), ISO `createdAt`, optional ISO `finishedAt`, `discovering`, `total`, `completed`, `failed`, and optional safe `error`. Counts track queued tasks, including descendants; a failed collection contributes a failed task. Totals can grow during discovery and descendant processing. Completion means collection and all associated tasks have settled, regardless of unrelated queue activity.

History holds active jobs and the latest 100 finished jobs in memory. It survives page reloads and resets on server restart. Jobs cannot be cancelled and are not stored in the database. Clients may poll every two seconds while visible and should mark retained data as stale when requests fail.

### Remote Imports
Trigger imports from configured remote seedboxes.

- **Trigger Import:** `POST /api/v1/system/imports`
  - **Body:**
    ```json
    {
      "source": "all",
      "type": "movies"
    }
    ```

`source` defaults to `all` and may be a configured seedbox name. `type` is required (`movies` or `tvshows`). Returns 200 `{ "success": true, "message": "Import triggered for 'movies' from 'all'" }`; an unknown named seedbox returns 404. Follow import events/status for progress.

### System Info
- **Get Info:** `GET /api/v1/system/info`
  - **Response:** `{ "version": "...", "platform": "linux", "arch": "x64", "uptime": 123, "nodeVersion": "v24...", "memory": { ... } }` (`uptime` in seconds, `memory` from Node's `process.memoryUsage()`)

### System Capabilities
Get list of available identifiers and updaters.

- **URL:** `/api/v1/system/capabilities`
- **Method:** `GET`
- **Response:**
  ```json
  {
    "tools": { "guessit": true, "ffmpeg": true, "ffprobe": true },
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

`GET /api/v1/status/sessions` requires authentication and returns only the current user's sessions, including their Emby sessions. Each entry contains `sessionId`, `state`, `file: { id, name, extension }` (name without directory), `method`, `reason`, `position`, `startupMs`, `bufferingReports`, `encodingSpeed`, `failure`, `queueDepth`, `activeEncoders`, `cacheBytes`, `operations` (per-track copy/encode/none), `delivery` (`queueWaitMs`, `generationMs`, `bufferedSeconds`, `rebufferDurationMs`), and `output` (`format`, `videoCodec`, `audioCodec`). No filesystem paths or media tokens are exposed. Encoding speed is media seconds per wall-clock second; startup includes preparation and is measured from creation handling to the first successful original/segment byte. `timings` contains preparation phases, `firstMediaMs` and client-reported `firstPlaybackMs` as described under managed playback. Startup/speed/failure can be null. Queue, encoder and cache values are server-wide gauges repeated in each row; do not sum them across sessions. Diagnostic `bufferingReports` counts truthy reports; statistics health counts buffering transitions.

### Connected Clients
Get the authenticated user's connected realtime devices. Scoped to the caller, even for administrators: an unfiltered listing would expose other people's devices. `user` carries the id and nothing else.

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
- **Permission:** `system.manage`
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
- **Response:** Array of file arrays, one inner array per duplicate hash. Each file includes linked `Movies` and `Episodes`. Requires `libraries.manage`.

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


## Federation administration

All `/api/v1/federation` endpoints require `settings.manage`. Requests without credentials return 401; users without permission receive 403. Federation settings also remain available through the existing settings GET/PATCH routes, with nested peer validation and live application. Private key paths retain the existing `***` unchanged sentinel.

| Method | Path suffix | Request | Response |
| --- | --- | --- | --- |
| GET | `/status` | — | `{ enabled, running, error?, peers, pairings }` |
| GET | `/identity` | — | `{ uuid, address, dataPort, mediaPort, certificate, publicKey }` |
| POST | `/identity` | `{ address }` | Prepare missing identity material and return public identity; preserves existing files |
| POST | `/invitations` | — | 201 `{ id, expires, invitation }`; expiration is epoch milliseconds |
| DELETE | `/invitations/:id` | — | 204; revoke invitation and cancel its pending pairing |
| POST | `/pairings` | `{ invitation }` | 202 `{ operationId }`; starts mutual pairing |
| GET | `/pairings/:id` | — | `{ id, state, uuid, expires, error? }` |
| DELETE | `/pairings/:id` | — | 204; cancel pending pairing; active trust must be removed as a peer |
| PUT | `/peers/:id` | `{ address, ca, dataPort, mediaPort, uuid?, fingerprint?, name?, enabled? }` | Updated status; replaces the outbound peer configuration at the immutable alias |
| DELETE | `/peers/:id` | Optional `?purge=true` | 204; removes outbound configuration and paired incoming authorization; optionally removes imported file records |
| POST | `/peers/:id/test` | — | `{ ok: true }` after verified metadata connection and authentication |
| POST | `/peers/:id/sync` | — | 202 `{ operationId }`; concurrent requests share the active operation |
| POST | `/peers/:id/reconnect` | — | Updated status after reconnect is scheduled |

A peer status contains `id`, `name`, `address`, `enabled`, `state`, and optional `lastSuccess`, `count`, `error`, `retryAt`, `operationId`. Timestamps are ISO strings. States are `disabled`, `disconnected`, `connecting`, `syncing`, `connected`, or `error`; `connected` indicates the most recent synchronization succeeded, not a permanent socket. Pairing states are `pending`, `prepared`, `active`, or `cancelled`. Poll `/status` to follow asynchronous operations.

Invalid peer settings return 400 `{ error: "Check the highlighted settings.", fields: { "federation.servers.<id>.<field>": "..." } }`. Other invalid operations return 400 with the usual API `{ code, message }` error envelope. Saved settings can fail activation (for example, a port is occupied); `/status.error` explains this independently of persisted settings. See [Federation](FEDERATION.md) for trust, ports, snapshot semantics, certificate replacement, and coordinated upgrades.

## File playback markers

- `GET /files/:id/markers` requires authentication and returns `{ "id", "duration", "chapters", "segments", "trickplay" }`. Times are seconds. Null fields mean analysis has not completed; empty arrays mean no chapters/segments were found. File `trickplay` contains sheet metadata (`width`, `height`, `tileWidth`, `tileHeight`, `interval`, `count`, numeric `sheets`, `bandwidth`), while session descriptors provide authorized sheet URLs.
- `PUT /files/:id/segments` requires `libraries.manage`. Body: `{ "segments": [{ "type": "intro", "start": 10, "end": 70 }] }`. Allowed types are `intro`, `credits`, `recap`, `preview`; times must be finite nonnegative numbers with end greater than start and within the file duration (up to one second of rounding is clamped). At most 32 segments are accepted. Replaces segments with `source: "manual"` and returns the marker record. An empty array disables detected segments for this file; analysis preserves it.
- `DELETE /files/:id/segments` requires `libraries.manage`. Clears all segments, including manual edits, and queues detection again. Returns 202 with the marker record.
- These routes return 404 for unknown files; PUT returns 400 for invalid segment input.

Playback analysis maintenance: `POST /api/v1/system/maintenance` with `{ "action": "analyse", "target": "all" }` (or target `movies`, `series`, legacy `tvshows`) requires `system.manage`. Returns 200 with the tracked job. Fills missing chapters, thumbnails and segments for local files; new files are queued automatically on identification.

## Statistics

Personal viewing is available to every signed-in user. Server-wide viewing history, library inventory,
and playback health require `statistics.view`; the built-in Administrators group receives it at startup.
Collection begins after migration 0012. Existing progress is not imported as watch time or history.

| Method and URL | Access | Response |
|---|---|---|
| `GET /api/v1/statistics/me/summary` | Signed-in user, own data only | Summary below |
| `GET /api/v1/statistics/me/history` | Signed-in user, own data only | `{ items, nextCursor, collection }` |
| `GET /api/v1/statistics/server/summary` | `statistics.view` | Summary, including viewer breakdown |
| `GET /api/v1/statistics/server/history` | `statistics.view` | `{ items, nextCursor, collection }` |
| `GET /api/v1/statistics/server/library` | `statistics.view` | `{ movies, series, episodes, files, localBytes, remoteFiles, missingSize, problematicFiles }` |
| `GET /api/v1/statistics/server/health` | `statistics.view` | `{ resolution, buckets, failures }` |

### Filters and paging

Summary, history and health accept `from` and `to` as `YYYY-MM-DD` UTC dates. `from` is inclusive,
`to` exclusive; defaults cover the last 30 UTC dates including today. A request may span at most 366 days;
older history remains available by selecting an earlier period. Invalid dates or ranges return `400`.
Server summary/history optionally accept a positive integer `userId`. Personal endpoints ignore this
parameter and always use the authenticated identity. Health is always server-wide.

History accepts `limit` (default 50, range 1–100) and an opaque `cursor`. Preserve the same date range
and viewer filter when following `nextCursor`; a mismatched or malformed cursor returns `400`.
Results are ordered by session start descending, with id as the tie-breaker. History selects sessions
**started** in the interval and returns whole-session totals. Summary apportions watch time by UTC day,
so a session crossing the selected boundary can contribute to summary without appearing in history.

### Summary and history fields

Summary returns `{ period, totals, daily, titles, kinds, users, trackingStartedAt, timezone, collection }`.
`timezone` is `UTC`. `totals` contains `watchSeconds`, `estimatedSeconds`, `plays`, `completions`,
`repeatPlays`, and `directSeconds`, `remuxSeconds`, `transcodeSeconds`, `unknownSeconds`.
`daily` adds `day` to those counters. `titles` returns the top 20 by watch time, adding `itemType`,
`itemId`, and a historical `title`. `kinds` groups by `itemType`. An unfiltered server summary includes
`users`, with `userId` and `username`; personal and user-filtered summaries return an empty `users` array.
Empty periods have zero totals and empty arrays. `trackingStartedAt` is null before collection initializes.

History items contain `id`, `userId`, `itemType`, `itemId`, `fileId`, `title`, `client`, `duration`,
`startedAt`, `lastReportAt`, `endedAt`, `endReason`, `watchSeconds`, `firstPlayedAt`, `completedAt`,
`quality`, `failure`, and `bufferingReports`. Times are ISO timestamps, durations seconds. Unavailable
references/timestamps and missing buffering telemetry are null. Quality is `reported`, `estimated`, or
`mixed`; no tokens, filesystem paths or internal checkpoints are returned. `endReason` is `stopped`,
`timeout`, `shutdown`, `interrupted`, or `failed`; null means the session has not been finalized.
Prepared sessions with no viewing remain in history as operational attempts.

`collection` is `{ degraded, lastFailureAt }`: degradation remains flagged for the server process after
a collection failure, because some activity may have been lost. Statistics failures do not fail playback.

### Definitions and retention

Watch time measures active elapsed time: a 60-minute title at 2× contributes approximately 30 minutes.
Paused, buffering and seeking time is excluded by the native player. Older/Jellyfin reports are estimated
conservatively from progress; implausible jumps and gaps longer than 60 seconds receive no credit.
A play is recorded on the first positive credited interval. A completion requires 90% distinct media
coverage within one session, once; seeking to the credits or manually marking watched does not qualify.
Repeated coverage adds watch time but not coverage. A repeat play is another qualifying session for the
same user/title after an earlier play. Unknown duration cannot complete. Simultaneous viewing sessions
contribute independently. First-play and completion counts belong to the UTC day they are recorded.

Individual sessions and daily totals remain indefinitely. Deleting a media item preserves its snapshot;
deleting a user cascades their session and daily history. Federated viewing belongs to the requesting
server's user, while the serving peer contributes local operational load.

Library totals are current, not historical. Files are counted once, independent of movie/episode joins;
local byte totals exclude remote files and unknown sizes. `missingSize` counts files with null size.

Health samples every 15 seconds. Each bucket has `{ at, samples, means, peaks }`; gauge fields are
`viewers`, `sessions`, `direct`, `remux`, `transcode`, `encoders`, `queue`, and `cacheBytes`. Viewers are
unique users reporting unpaused, non-buffering playback within the last 60 seconds. Sessions count
allocated managed streams, including prepared/paused streams and serving peers. Encoder counts and
cache bytes describe this server. Jellyfin fallback viewing can count as a viewer without an allocated
managed stream. `failures` reports `attempts`, `failedSessions`, `failedAttempts`, `bufferingReports`,
and `bufferingKnownSessions` for sessions started in the period; absent telemetry is null. Buffering
counts transitions into a reported buffering state, not buffering duration.
Minute buckets remain for 30 days; hourly summaries remain indefinitely. Requests spanning more than
7 days or starting over 30 days ago use hourly buckets. Missing buckets indicate missing measurements,
not zero load. CPU, process/host monitoring and bandwidth accounting are outside this API.
