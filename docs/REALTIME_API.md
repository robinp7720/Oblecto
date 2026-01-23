# Realtime API Documentation

The Realtime API in Oblecto is built on top of [Socket.IO](https://socket.io/). It enables real-time communication between the Oblecto server and connected clients, primarily for tracking playback progress and remote controlling playback.

## Connection

The Socket.IO server is attached to the main Oblecto HTTP server.

- **Transports:** `websocket`, `polling`
- **Origins:** `*:*` (All origins allowed)

### Lifecycle

1.  **Connect:** Client establishes a Socket.IO connection.
2.  **Authenticate:** Client **MUST** emit the `authenticate` event with a valid JWT token immediately after connection.
3.  **Interaction:** Client sends playback updates; Server may send playback commands.
4.  **Disconnect:** Connection is closed by either party.

## Authentication

Authentication is required to associate the socket connection with a user account. If authentication fails, the server disconnects the socket.

### Client -> Server: `authenticate`

Emitted by the client to authenticate the connection.

**Payload:**

```json
{
  "token": "YOUR_JWT_TOKEN"
}
```

- `token`: A valid JWT string obtained via the REST API login.

## Events

### Client -> Server: `playing`

Emitted by the client to report playback progress. The server buffers this data and persists it to the database periodically (every 10 seconds).

**Payload (Episode):**

```json
{
  "type": "tv",
  "episodeId": "string",
  "time": 12345,
  "progress": 0.5
}
```

**Payload (Movie):**

```json
{
  "type": "movie",
  "movieId": "string",
  "time": 12345,
  "progress": 0.5
}
```

- `type`: Literal `"tv"` or `"movie"`.
- `episodeId` / `movieId`: The UUID of the media item.
- `time`: Current playback position in seconds (or milliseconds, depending on client implementation - codebase implies a number stored as `time`).
- `progress`: Floating point number representing completion percentage (0.0 to 1.0).

### Server -> Client: `play`

Emitted by the server to command the client to start playback of a specific item. This is typically triggered via the REST API (`POST /client/:clientId/playback`).

**Payload (Episode):**

```json
{
  "episodeId": "string"
}
```

**Payload (Movie):**

```json
{
  "movieId": "string"
}
```

## Example Interaction

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:8080");

socket.on("connect", () => {
  console.log("Connected");
  
  // Authenticate
  socket.emit("authenticate", { token: "eyJhbG..." });
});

// Handle remote play commands
socket.on("play", (data) => {
  if (data.episodeId) {
    console.log("Remote play episode:", data.episodeId);
    // Start playback logic...
  } else if (data.movieId) {
    console.log("Remote play movie:", data.movieId);
  }
});

// Report progress while playing
setInterval(() => {
  socket.emit("playing", {
    type: "movie",
    movieId: "123-456",
    time: 60,
    progress: 0.05
  });
}, 5000);
```

## Error Handling

- If `authenticate` fails (invalid token), the server logs a warning ("An unauthorized user attempted connection...") and disconnects the socket.
- No specific error events are emitted by the server application logic; standard Socket.IO error handling applies.
