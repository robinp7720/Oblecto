# Realtime Socket Interface (src/lib/realtime/)

What lives here
- `RealtimeController.ts`: Manages the Socket.IO server and client connections.
- `RealtimeClient.ts`: Handles individual client socket sessions, authentication, and event processing.

Notes
- This module implements the Realtime API documented in `docs/REALTIME_API.md`.
- **CRITICAL:** If you modify the events, payloads, or authentication flow in this directory, you **MUST** update `docs/REALTIME_API.md` to reflect these changes.
- The `playing` event updates are buffered in `RealtimeClient` and saved to the database every 10 seconds via `saveAllTracks`.
