# Jellyfin/Emby Emulation Layer (embyEmulation)

This layer allows Oblecto to act as a Jellyfin/Emby server, enabling compatibility with existing clients like Jellyfin Media Player, the Jellyfin web client, and third-party apps.

## Architecture

The emulation layer is organized into several key components:

### 1. Orchestrator (`src/lib/embyEmulation/index.js`)
The `EmbyEmulation` class manages sessions, WebSockets (via Primus), and the server API lifecycle. It handles user authentication and maintains a mapping of active sessions (`this.sessions`).

### 2. Server API (`src/lib/embyEmulation/ServerAPI/index.js`)
An Express-based server listening on port `8096`. It includes critical middleware:
- **URL Lowercasing**: All incoming URLs are lowercased to simplify route matching.
- **Parameter Mapping**: Merges `req.query`, `req.body`, and `req.params` into `req.params` for legacy compatibility.
- **Emby Header Parsing**: Parses the `X-Emby-Authorization` header (or equivalent) into `req.headers.emby`.

### 3. Route Handlers (`src/lib/embyEmulation/ServerAPI/routes/`)
Routes are modularized by functional area:
- `users/`: Authentication, views (`/UserViews`), and user-specific item lists (`/Users/:userid/Items`).
- `shows/`: NextUp (`/Shows/NextUp`), seasons, and episodes.
- `items/`: General item lookup (`/Items/:mediaid`), playback info, and image endpoints.
- `system/`: Ping and server info (`/System/Info`).
- `displaypreferences/`: UI state management for clients.

### 4. Helpers (`src/lib/embyEmulation/helpers.js`)
Crucial for data transformation between Oblecto's internal models and the Jellyfin API spec:
- **ID System**: IDs are prefixed to indicate type (e.g., `1` for Movies, `2` for Series).
- **`formatMediaItem`**: Standardizes the response format for media items, including `Overview`, `UserData`, and `ImageTags`.
- **UUID Handling**: Methods for formatting and parsing the 32-character hex UUIDs used by Emby clients.

## Key Concepts

### ID Prefixing
To avoid ID collisions across different media types, IDs are encoded as a single-character hex prefix followed by the 31-char hex representation of the numeric ID:
- `1...`: Movie
- `2...`: Series
- `3...`: Episode
- `4...`: Season
- `f...`: User

### Case-Insensitivity and Query Parameters
Because the middleware lowercases the request URL, query parameter keys are often expected to be lowercase. When accessing query parameters, always handle both CamelCase and lowercase variations (e.g., `req.query.SortBy || req.query.sortby`).

### Robust Logic Fallbacks
The API often receives requests where `IncludeItemTypes` is empty (e.g., when a client navigates into a series). The implementation must use `ParentId` to intelligently list the intended child types:
- If `ParentId` represents a Series -> Return its Seasons.
- If `ParentId` represents a Season -> Return its Episodes.

## Implementation Status

### Supported Features
- **Authentication**: Authentication by name and session persistence.
- **Libraries**: Mapping of Movies and TV Shows into "User Views".
- **TV Support**: Robust "Next Up" logic and full series/season/episode navigation.
- **Metadata**: Support for item descriptions (`Overview`), ratings, and production years.
- **Playback**: Playback info negotiation and Direct Stream support.
- **Images**: Dynamic serving of primary posters and backdrops.

### Known Nuances
- **Unmatched Routes**: If a route remains unmatched, ensure it's registered in `users/index.js` or `items/index.js` and that the URL pattern matches the lowercased version of the request.
- **Next Up**: This logic uses `TrackEpisode` data to determine the current progress and subsequent episode in a series.

## Extending the API

1.  **Add a Route**: Register the endpoint in the appropriate file in `src/lib/embyEmulation/ServerAPI/routes/`.
2.  **Access Parameters**: Use `req.query` for query parameters, ensuring you check for lowercased keys.
3.  **Return Data**: Always use `formatMediaItem(item, type, embyEmulation)` to transform database models into API-compliant objects.
