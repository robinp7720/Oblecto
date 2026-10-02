# Jellyfin/Emby Emulation Layer (embyEmulation)

This layer lets Oblecto act as a Jellyfin server, so existing clients (Jellyfin Media Player, the Jellyfin web client, mobile and TV apps) can sign in, browse and play.

## Architecture

### 1. Orchestrator (`src/lib/embyEmulation/index.ts`)
The `EmbyEmulation` class owns sessions (`this.sessions`, keyed by access token), the Primus WebSocket at `/socket`, and the server API. The socket accepts the token as `?api_key=` (older apps) or `?ApiKey=` (the Jellyfin SDK, so jellyfin-web). It sends `ForceKeepAlive`, answers `KeepAlive`, and pushes `UserDataChanged` when `progressEvents` or `favouriteEvents` fire. `serverName` is read from `jellyfin.serverName` each time.

### 2. Server API (`src/lib/embyEmulation/ServerAPI/index.ts`)
An Express 5 server on `jellyfin.port` (8096). Middleware, in order:
- **Path lowercasing**: the path is lowercased so routes match; query keys and values keep their case.
- **Emby header parsing**: `X-Emby-Authorization`/`Authorization: MediaBrowser …` into `req.headers.emby`.
- **Session guard** (`sessionGuard.ts`): everything but discovery, sign-in, branding, localisation, images and the web client needs a session. It sets `req.embyUserId` and pins every user id in the path, query and body to the signed-in user.

### 3. Shared building blocks (`ServerAPI/`)
- `itemQuery.ts`: the one engine behind `GET /Items`, `/Users/{id}/Items` and the `/Shows` lists. `readItemQuery` turns a request into an `ItemQuery` (kinds, parent, filters, sort, page), and `runItemQuery` runs it. Add new filters here, not in routes. Routes that fix some parameters pass them as `queryItems(req, emby, overrides)`: `req.query` is read-only in Express 5.
- `itemDetails.ts`: `decorateItems` fills in favourites, folder counts and unplayed counts for a page in batched queries. `describeItem` adds People for detail pages. `userItemData` builds one item's UserData.
- `library.ts`: collections (BoxSets from movie sets the user may see), people, genres, similar titles, ancestors, and `resolveLibraryItem` for those ids.
- `serverConfiguration.ts`: system, encoding and branding configuration, read from and saved to Oblecto's config through `validateSettings`/`mergeSettings`/`ConfigManager.updateConfig`.
- `requestUtils.ts`: `getRequestValue` and `getRequestList` read query and body parameters case-insensitively. Use them rather than `req.query.X`.

### 4. Routes (`ServerAPI/routes/`)
By area: `users/` (sign-in, user data, favourites, configuration), `items/` (item lookup, images, playback info, similar, filters), `shows/`, `library/` (genres, collections, library scans), `artists/` (persons), `system/`, `branding/`, `displaypreferences/`, `sessions/`, `videos/` and the stubs.

### 5. Helpers (`helpers.ts`)
`formatMediaItem` turns a movie, series, season or episode into a BaseItemDto. It includes only what Oblecto knows; never invent ratings, genres or artwork. `formatId`/`parseId` handle ids, and `genreId` gives a genre its stable id.

## Key concepts

### Item ids
32 hex characters: a type prefix and the numeric id in the remaining 31.
- `1…` movie, `2…` series, `3…` episode, `4…` season (series id × 1000 + season number)
- `5…` person, `6…` collection (movie set), `8…` reserved for series sets, `f…` user
- `7…` genre: a hash of the name, resolved by looking the name up (`genreNames`)
- Library views use the ids `movies`, `shows` and `collections` (`views.ts`).

### Watch state and favourites
Watched means progress of `WATCHED_PROGRESS` (0.9) or more, as everywhere in Oblecto. Favourites are in `UserFavourites` (`src/lib/users/favourites.ts`). Display preferences are in `JellyfinDisplayPreferences`.

### Parents and fallbacks
Clients often leave `IncludeItemTypes` empty and rely on `ParentId`. The engine then lists what the parent holds: a view its kind, a series its seasons, a season its episodes, a collection its movies.

## Extending the API

When extending the Jellyfin/Emby emulation layer:
- Always reference the Jellyfin OpenAPI spec (`jellyfin-openapi-stable.json`); fetch or refresh it with `scripts/fetch-jellyfin-openapi.sh`.
- Use `PLAN.md` as the source of truth for current coverage and gaps.
- Document every change you make in `PLAN.md` under the Change log section (date + short summary), and keep `docs/JELLYFIN.md` in step.
- Keep route implementations aligned with the spec path shapes, HTTP methods, and required parameters. Register specific paths before `/:param` ones that would swallow them.
- Route tests call handlers with plain request objects. Give them a read-only `query`, as Express 5 has it (see `tests/mocha/embyLibrary.spec.ts`), and check new behaviour against the bundled jellyfin-web too.
