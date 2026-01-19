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

The REST streaming API uses a two-step flow: create a session, then request the stream.
HLS is served via the same session stream endpoint for playlists plus a segment endpoint.

### Create Session
Initialize a streaming session for a file. Requires authentication.

- **URL:** `/session/create/:id`
- **Method:** `GET`
- **Auth:** `Authorization: Bearer <token>`
- **Query Params:**
  - `formats`: Comma-separated list (default: `mp4`).
  - `videoCodecs`: Comma-separated list (default: `h264`).
  - `audioCodec`: Comma-separated list (default: `aac`).
  - `type`: `recode`, `directhttp`, or `hls` (default: `recode`).
  - `offset`: Start time in seconds (default: `0`).
  - `noremux`: If present, force direct playback (`directhttp`).
- **Response:**
  ```json
  {
    "sessionId": "uuid",
    "seeking": "client" | "server",
    "outputCodec": {
      "video": "h264",
      "audio": "aac"
    },
    "inputCodec": {
      "video": "h264",
      "audio": "aac"
    }
  }
  ```

### Stream (Direct or HLS Playlist)
Start the actual data stream or (for HLS) receive the `.m3u8` playlist.

- **URL:** `/session/stream/:sessionId`
- **Method:** `GET`
- **Query Params:**
  - `offset`: Seek offset in seconds (server-side seek).
  - `nostart`: If present, set up the destination but do not start the stream immediately.
- **Notes:**
  - For `directhttp` and `recode`, this returns the media stream directly.
  - For `hls`, this returns the playlist (`Content-Type: application/x-mpegURL`).
  - HLS clients should re-request this endpoint to refresh the playlist.

### HLS Segment
Fetch a specific HLS segment referenced by the playlist.

- **URL:** `/HLS/:sessionId/segment/:id`
- **Method:** `GET`

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

### List Clients
List connected clients for the current user.

- **URL:** `/clients`
- **Method:** `GET`

### Remote Playback
Control playback on another client.

- **URL:** `/client/:clientId/playback`
- **Method:** `POST`
- **Body:**
  - `type`: `episode` or `movie`
  - `id`: ID of the media to play.

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

## Files

### Find Duplicates
- **URL:** `/files/duplicates`
- **Method:** `GET`
- **Response:** List of files with duplicate hashes.
