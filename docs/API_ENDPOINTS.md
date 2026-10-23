# Oblecto native endpoint index

This is the complete native HTTP route inventory for this checkout. Read [API conventions and errors](API.md#transport-and-conventions) first. Paths are relative to the native server (default port 8080); `:id` and other colon-prefixed components are URL path parameters. JSON is the default response format. **200** is the success status unless another code is shown. Binary images/media, redirects and empty bodies are called out explicitly.

Access: **Public** needs no login; **User** needs a valid native Bearer token; a permission string requires that permission; **Self/users.manage** permits one's own user ID or `users.manage`. **Media token** means the scoped `token` query parameter in a returned playback URL, not the login token. Parameter schemas and error details are in the linked section for each group; model names refer to [response models](API_MODELS.md).

## Authentication and account

Contracts: [authentication](API.md#authentication), [account](API.md#account-v1). Sources: [auth.ts](../src/submodules/REST/routes/auth.ts), [account.ts](../src/submodules/REST/routes/v1/account.ts).

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `GET /auth/login-options` | Public | None | `{ local, profilePicker, users: [{ id, username, name, avatar, passwordless }] }` |
| `POST /auth/login` | Public | `{ username, password }` or `{ userId, password? }`; password omission conditional | `{ accessToken }`; 400/401 invalid login, 429 throttled |
| `GET /api/v1/me` | User | None | Account with preferences and effective permissions |
| `PATCH /api/v1/me` | User | Partial `{ name, email, preferences }` | Updated account; invalid preference fields: 400 |
| `PUT /api/v1/me/password` | User | `{ currentPassword?, newPassword }` | Account; current token invalidated, no replacement issued |
| `PUT /api/v1/me/avatar` | User | One multipart image | Updated account |
| `DELETE /api/v1/me/avatar` | User | None | Updated account |

## Movies

Contract: [movies](API.md#movies). Source: [movies.ts](../src/submodules/REST/routes/movies.ts). `:id` is a movie ID except `/movies/set/:id`, where it is a set ID.

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `GET /movies/list/:sorting` | User | Browse filters/cursor or legacy `order,count,page` | Browse envelope or `Movie[]`; caller `TrackMovies` |
| `GET /movies/search/:name` | User | Encoded title substring; no paging | `Movie[]` with `Files`, without caller tracks |
| `GET /movies/watching` | User | None | `Movie[]` with caller tracks, recently updated incomplete progress |
| `GET /movie/:id/info` | User | None | Movie detail, files/streams, caller tracks, credits, saved flags |
| `GET /movie/:id/extras` | User | None | `{ trailers, certifications, unavailable }` |
| `GET /movie/:id/related` | User | None | `{ items: Movie[] }`, up to 12, with relationships and caller tracks |
| `PUT /movie/:id/favourite` | User | `{ favourite: boolean }` | `{ favourite }` |
| `PUT /movie/:id/watchlist` | User | `{ watchlist: boolean }` | `{ watchlist }` |
| `PUT /movie/:id/watched` | User | `{ watched: boolean }` | `{ watched, track }` |
| `GET /movie/:id/poster` | Public | `size`, default `medium` | JPEG image; missing: 404 |
| `PUT /movie/:id/poster` | `libraries.manage` | One portrait multipart image | `["success"]` |
| `GET /movie/:id/fanart` | Public | `size`, default `large` | JPEG image; missing: 404 |
| `PUT /movie/:id/fanart` | `libraries.manage` | One landscape multipart image | `["success"]` |
| `GET /movies/sets` | User | None | Visible `MovieSet[]` |
| `GET /movies/set/:id` | User | `count=20,page=0,order?`; outer set pagination | `MovieSet[]` with `Movies[].TrackMovies`; hidden/absent: `[]` |
| `GET /movie/:id/sets` | User | None | Visible `MovieSet[]` including member `Movies` and caller tracks |
| `PUT /movie/:id/sets` | `libraries.manage` | `{ setId }` | `{ success: true }`; adds membership |

## Series

Contract: [series](API.md#tv-shows-series). Source: [tvshows.ts](../src/submodules/REST/routes/tvshows.ts). `:id` is a series ID except `/series/set/:id`, where it is a set ID. `:episodeId` is a native episode ID in that series; `:season` is the exact stored aired-season string.

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `GET /series/list/:sorting` | User | Browse filters/cursor or legacy `order,count,page` | Browse envelope or `Series[]`; no aggregate progress |
| `GET /shows/search/:name` | User | Encoded title substring; no paging | `Series[]` (note `/shows`, not `/series/search`) |
| `GET /series/:id/info` | User | None | Series detail, normalized genre, credits, saved flags |
| `GET /series/:id/extras` | User | None | `{ trailers, certifications, unavailable }` |
| `GET /series/:id/related` | User | None | `{ items: Series[] }`, up to 12, with relationships |
| `GET /series/:id/episodes` | User | None; no pagination | `Episode[]` with compact parent/files and caller tracks; unknown series: `[]` |
| `GET /series/:id/library` | `libraries.manage` | None | `{ series, catalogAvailable, catalogUpdatedAt, unavailable, rows }`; provider/local matching workspace |
| `PUT /series/:id/favourite` | User | `{ favourite: boolean }` | `{ favourite }` |
| `PUT /series/:id/watchlist` | User | `{ watchlist: boolean }` | `{ watchlist }` |
| `PUT /series/:id/seasons/:season/watched` | User | `{ watched: boolean }` | `{ watched, episodes: [{ id, track }] }`; absent series/season: 404 |
| `PUT /series/:id/episodes/:episodeId/earlier/watched` | User | `{ watched: true }`, only true | `{ watched: true, episodes: [{ id, track }] }`; excludes anchor |
| `GET /series/:id/poster` | Public | `size`, default `medium` | JPEG image |
| `PUT /series/:id/poster` | `libraries.manage` | One portrait multipart image | `["success"]` |
| `GET /series/:id/fanart` | Public | `size`, default `large` | JPEG image; no corresponding native PUT |
| `GET /series/sets` | User | None | Visible `SeriesSet[]` |
| `GET /series/set/:id` | User | `count=20,page=0`; outer set pagination | `SeriesSet[]` with `Series` members; hidden/absent: `[]` |
| `GET /series/:id/sets` | User | None | Visible `SeriesSet[]`, including member `Series` |
| `PUT /series/:id/sets` | `libraries.manage` | `{ setId }` | `{ success: true }`; adds membership |

## Episodes

Contract: [episodes](API.md#episodes). Source: [episodes.ts](../src/submodules/REST/routes/episodes.ts). All `:id` values here are episode IDs.

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `GET /episodes/list/:sorting` | User | Model field (e.g. `createdAt`, `episodeName`); required `order=asc/desc`; `count=20,page=0` | `Episode[]` with parent and caller tracks; no browse mode |
| `GET /episodes/search/:name` | User | Encoded title substring; no paging | `Episode[]` with parent, files and caller tracks |
| `GET /episodes/watching` | User | None | `Episode[]` with parent/caller tracks; seven-day resume shelf |
| `GET /episodes/next` | User | None | Up-next `Episode[]` with parent/caller tracks based on recently finished episodes |
| `GET /episode/:id/info` | User | None | Episode detail with parent, files/streams, caller tracks, credits, favourite flag |
| `GET /episode/:id/files` | User | None | `File[]`, no streams; legacy missing episode can produce 500 |
| `GET /episode/:id/context` | User | None | `{ previous, next, nearby, nextUnwatched, season }` |
| `GET /episode/:id/next` | User | None | Bare episode or empty 200 body; legacy text ordering; prefer context |
| `PUT /episode/:id/favourite` | User | `{ favourite: boolean }` | `{ favourite }` |
| `PUT /episode/:id/watched` | User | `{ watched: boolean }` | `{ watched, track }` |
| `GET /episode/:id/banner` | Public | `size`, default `medium` | JPEG image |
| `PUT /episode/:id/banner` | `libraries.manage` | One landscape multipart image | `["success"]` |

## Collections and people

Contracts: [sets](API.md#sets), [people](API.md#people-and-credits). Sources: [sets.ts](../src/submodules/REST/routes/sets.ts), [people.ts](../src/submodules/REST/routes/people.ts).

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `POST /set/movie` | `libraries.manage` | `{ name, public: boolean, overview? }` | Movie set, 200 even when created; existing visible same-name set returned |
| `POST /set/series` | `libraries.manage` | Same schema | Series set; existing hidden same-name set: 404 |
| `DELETE /set/movie/:id` | `libraries.manage` | Movie-set ID | `{ success: true }`; unknown: 404 |
| `DELETE /set/series/:id` | `libraries.manage` | Series-set ID | `{ success: true }`; unknown: 404 |
| `GET /people/search/:name` | User | Encoded substring; `count` default 20, bounded 1–50 | `Person[]`, name ascending |
| `GET /person/:id/info` | User | Person ID | Person with `credits: { movies, series, episodes }`; unknown: 404 |
| `GET /person/:id/profile` | Public | Person ID, `size` default `medium` | Profile image; absent: 404 |

## Playback

Contract: [streaming](API.md#streaming). Source: [streaming.ts](../src/submodules/REST/routes/streaming.ts). Session control `:id` is an opaque session ID, not a media ID. The authenticated user must own the session; another user's session is indistinguishable from an expired one.

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `POST /playback/sessions` | User | `{ fileId, position?, quality?, capabilities?, audioStreamIndex?, subtitleStreamIndex?, subtitleMode?, maxBitrate?, forceHls?, forceDirect? }` | **201** descriptor |
| `GET /playback/sessions/:id` | User/owner | None | Descriptor; does not refresh idle lease |
| `PATCH /playback/sessions/:id` | User/owner | Current `revision`, explicit current `position`, changed playback options | Replacement descriptor with incremented revision |
| `POST /playback/sessions/:id/progress` | User/owner | `{ revision, position, paused?, buffering?, sequence?, activeSeconds?, playedRanges?, playbackRate?, failed? }` | **204** |
| `DELETE /playback/sessions/:id` | User/owner | None | **204**, including already absent sessions |
| `GET /playback/media/:id/:revision/:asset` | Media token | Returned URL and `token`; optional single `Range` for original | Media/playlist/subtitle/thumbnail bytes; **206** for an original range |
| `HEAD /playback/media/:id/:revision/:asset` | Media token | Same URL; original-file Range ignored | Headers only, 200 for an available resource; Express GET fallback |

Use returned URLs, including their scoped tokens, rather than constructing assets. See [desktop playback lifecycle](DESKTOP_CLIENTS.md#start-and-control-playback).

## Files and analysis

Contracts: [files](API.md#files), [markers](API.md#file-playback-markers). Source: [files.ts](../src/submodules/REST/routes/files.ts). `:id` is a file ID.

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `GET /files/duplicates` | `libraries.manage` | None | `File[][]`, one inner group per duplicate hash, including `Movies`/`Episodes` |
| `GET /files/problematic` | `libraries.manage` | `stage=identify/probe`, `includeIgnored=true` optional | Problem-file records with compact linked titles; newest first |
| `POST /files/problematic/retry` | `libraries.manage` | Optional `{ stage }` | **202** `{ queued: number, removedIds, skippedIds }` |
| `POST /files/:id/retry` | `libraries.manage` | None | **202** `{ queued: true, jobs: string[] }`; 400/404/409/410 as documented |
| `PATCH /files/:id` | `libraries.manage` | `{ problemIgnored: boolean }` | `{ id, problemIgnored }` |
| `GET /files/:id/markers` | User | None | `{ id, duration, chapters, segments, trickplay }` |
| `PUT /files/:id/segments` | `libraries.manage` | `{ segments: [{ type, start, end }] }`, max 32; full replacement | Marker record; manual source assigned |
| `DELETE /files/:id/segments` | `libraries.manage` | None | **202** marker record; clears overrides and queues redetection |

## Users and groups

Contracts: [users](API.md#users), [permissions](API.md#permissions-and-groups). Sources: [users.ts](../src/submodules/REST/routes/users.ts), [groups.ts](../src/submodules/REST/routes/v1/groups.ts).

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `GET /users` | `users.manage` | None | `User[]` |
| `GET /user/:id` | Self/users.manage | User ID | User; missing record: empty 200 body |
| `POST /user` | `users.manage` | Required `username,name,email`; optional `password,publicProfile,passwordlessLocal,groupId` | User, 200; existing username returned unchanged |
| `PUT /user/:id` | `users.manage` | Partial user fields including password/group; JSON body | Updated user; unknown ID: 400; last manager demotion: 409 |
| `DELETE /user/:id` | `users.manage` | User ID | Deleted public user record; last manager: 409 |
| `GET /user/:id/avatar` | Public | Optional `v` equal to current avatar filename | 256×256 WebP; absent: 404 |
| `PUT /user/:id/avatar` | Self/users.manage | One multipart image | Updated user |
| `DELETE /user/:id/avatar` | Self/users.manage | None | Updated user |
| `GET /api/v1/permissions` | `users.manage` | None | `[{ key, description }]` |
| `GET /api/v1/groups` | `users.manage` | None | `Group[]` with member counts |
| `POST /api/v1/groups` | `users.manage` | `{ name, permissions? }`; defaults to `[]` | Group, 200; duplicate name: 409 |
| `PATCH /api/v1/groups/:id` | `users.manage` | Partial `{ name, permissions }`; permissions replaces full list | Updated group |
| `DELETE /api/v1/groups/:id` | `users.manage` | Group ID | `{ id }`; members move to Users; built-in/last-manager conflict: 409 |

## Settings and libraries

Contract: [settings and system](API.md#settings--system-v1). Sources: [settings.ts](../src/submodules/REST/routes/v1/settings.ts), [libraries.ts](../src/submodules/REST/routes/v1/libraries.ts). `:type` is `movies` or `tvshows`. These are server library settings/paths, not pageable media collections.

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `GET /api/v1/settings` | `settings.manage` | None | Full configuration with selected secrets masked |
| `PATCH /api/v1/settings` | `settings.manage` | Partial configuration sections | Updated scrubbed configuration |
| `GET /api/v1/settings/:section` | `settings.manage` | Allowed section name | Section value; unknown section: 400, absent: 404 |
| `PATCH /api/v1/settings/:section` | `settings.manage` | Section update | Updated scrubbed section |
| `POST /api/v1/settings/providers/:provider/test` | `settings.manage` | Provider `themoviedb`, `tvdb`, `fanart.tv`; no body | `{ ok, code, message }`; provider failure remains 200 |
| `GET /api/v1/libraries` | User | None | `{ movies: configuration, tvshows: configuration }` |
| `GET /api/v1/libraries/:type` | User | Library type | Directory array, e.g. `[{ path }]` |
| `PATCH /api/v1/libraries/:type` | `libraries.manage` | Nonempty partial library configuration | Updated library section |
| `POST /api/v1/libraries/:type/paths` | `libraries.manage` | `{ path }` | Updated directory array; duplicate: 409 |
| `DELETE /api/v1/libraries/:type/paths` | `libraries.manage` | `{ path }` in JSON body | Updated directory array; unknown path: 404 |

## System and status

Contracts: [system](API.md#system-maintenance), [status](API.md#status-v1). Sources: [system.ts](../src/submodules/REST/routes/v1/system.ts), [status.ts](../src/submodules/REST/routes/v1/status.ts).

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `GET /api/v1/system/info` | User | None | `{ version, platform, arch, uptime, nodeVersion, memory }` |
| `GET /api/v1/system/capabilities` | User | None | `{ tools: { guessit, ffmpeg, ffprobe }, movies, tvshows }` provider identifiers/updaters |
| `POST /api/v1/system/maintenance` | `system.manage` | `{ action, target }`, see supported matrix | **200** `{ success: true, message, job }`; accepted, not completed |
| `GET /api/v1/system/maintenance/jobs` | `system.manage` | None | Job array, newest first |
| `POST /api/v1/system/imports` | `system.manage` | `{ type: "movies"/"tvshows", source?: "all"/seedboxName }` | `{ success: true, message }`; default source all; unknown source: 404 |
| `GET /api/v1/status/sessions` | User | None | Caller-owned session diagnostics array; no media tokens |
| `GET /api/v1/status/clients` | User | None | Caller-owned device array with `user: { id }` |
| `GET /api/v1/status/seedbox` | `system.manage` | None | `{ seedboxes: [{ name }], queue: { length, running, idle } }` |

## Federation administration

Contract: [federation administration](API.md#federation-administration). Source: [federation.ts](../src/submodules/REST/routes/v1/federation.ts). All routes require `settings.manage`. Peer `:id` is an alias; invitation/pairing IDs are opaque strings.

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `GET /api/v1/federation/status` | `settings.manage` | None | `{ enabled, running, error?, peers, pairings }` |
| `GET /api/v1/federation/identity` | `settings.manage` | None | Public identity `{ uuid, address, dataPort, mediaPort, certificate, publicKey }` |
| `POST /api/v1/federation/identity` | `settings.manage` | `{ address }` | Prepared public identity |
| `POST /api/v1/federation/invitations` | `settings.manage` | None | **201** `{ id, expires, invitation }` |
| `DELETE /api/v1/federation/invitations/:id` | `settings.manage` | None | **204** |
| `POST /api/v1/federation/pairings` | `settings.manage` | `{ invitation }` | **202** `{ operationId }` |
| `GET /api/v1/federation/pairings/:id` | `settings.manage` | None | `{ id, state, uuid, expires, error? }` |
| `DELETE /api/v1/federation/pairings/:id` | `settings.manage` | None | **204** |
| `PUT /api/v1/federation/peers/:id` | `settings.manage` | Peer configuration, full replacement at alias | Updated federation status |
| `DELETE /api/v1/federation/peers/:id` | `settings.manage` | Optional `purge=true` | **204** |
| `POST /api/v1/federation/peers/:id/test` | `settings.manage` | None | `{ ok: true }` after verified connection |
| `POST /api/v1/federation/peers/:id/sync` | `settings.manage` | None | **202** `{ operationId }` |
| `POST /api/v1/federation/peers/:id/reconnect` | `settings.manage` | None | Updated status |

## Statistics

Contract: [statistics](API.md#statistics). Source: [statistics.ts](../src/submodules/REST/routes/v1/statistics.ts). Dates are UTC `YYYY-MM-DD`: `from` inclusive, `to` exclusive, at most 366 days. Default period covers the last 30 UTC dates. History `limit` defaults to 50, range 1–100; preserve date/viewer filters with cursors.

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `GET /api/v1/statistics/me/summary` | User | `from,to` | Own summary with period/totals/daily/titles/kinds/users/trackingStartedAt/timezone/collection |
| `GET /api/v1/statistics/me/history` | User | `from,to,limit,cursor` | `{ items, nextCursor, collection }`; ignores supplied user ID |
| `GET /api/v1/statistics/server/summary` | `statistics.view` | `from,to,userId?` | Summary, optional viewer breakdown |
| `GET /api/v1/statistics/server/history` | `statistics.view` | `from,to,userId?,limit,cursor` | `{ items, nextCursor, collection }` |
| `GET /api/v1/statistics/server/library` | `statistics.view` | None | `{ movies, series, episodes, files, localBytes, remoteFiles, missingSize, problematicFiles }` |
| `GET /api/v1/statistics/server/health` | `statistics.view` | `from,to`; always server-wide | `{ resolution, buckets, failures }` |

## Web assets and other transports

Source: [web.ts](../src/submodules/REST/routes/web.ts). These routes only exist when `web.enabled` is true.

| Endpoint | Access | Input | Success response |
| --- | --- | --- | --- |
| `GET /` | Public | None | **302** to `/web/` |
| `GET /web/logo.png` | Public | None | PNG logo |
| `GET /web/` | Public | None | Built web app index |
| `GET /web/*route` | Public | Static asset path or client-side route | Built asset, or SPA index fallback |

Socket.IO is mounted on the native HTTP server at `/socket.io/`; its event contract is [REALTIME_API.md](REALTIME_API.md). It is not a JSON REST route. All remote control lives there. Jellyfin paths on port 8096 are a separate compatibility surface; see [JELLYFIN.md](JELLYFIN.md). Federation metadata/media sockets are server-to-server protocols; a desktop client uses ordinary native playback even for remote files.

## Unsupported native operations

There are no native refresh/logout/self-registration, season-list, full-series watched mutation, episode-watchlist, general metadata-edit, title-delete, individual set-member removal, set-sharing management, media-file upload, download-job, or REST remote-control endpoints. Do not infer CRUD operations from the existing reads. Removed streaming routes are listed under [breaking migration](API.md#breaking-migration). The absence of a route can return an HTML 404 rather than a JSON error.
