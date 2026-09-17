# Realtime Socket Interface (src/lib/realtime/)

What lives here
- `types.ts`: The wire protocol — payload types, event constants, and a runtime validator per inbound shape. Depends on nothing else in the tree, so tests can import it cheaply.
- `DeviceRegistry.ts`: In-memory directory of connected devices, keyed by user and then by device id. Knows nothing about Socket.IO; it holds sockets opaquely and hands them back to the controller.
- `RealtimeController.ts`: Owns the Socket.IO server, the handshake authentication middleware, the registry, and `dispatchCommand` — the single authorization chokepoint for remote play.
- `RealtimeClient.ts`: One authenticated socket. Handles `playback:state` and `remote:command`, and delivers commands to its own device.

Notes
- This module implements the Realtime API documented in `docs/REALTIME_API.md`.
- **CRITICAL:** If you modify the events, payloads, or authentication flow in this directory, you **MUST** update `docs/REALTIME_API.md` to reflect these changes.
- Authentication is in the handshake (`io.use`), not a post-connect event. Anything reaching `connection` already has a verified user and a validated device identity, so no handler needs a null-user guard. Do not reintroduce one.
- A device is addressed by its client-generated, client-persisted `deviceId`, never by `socket.id`. Socket ids change on every reload, which is what made remote targets go stale.
- Commands are resolved **inside the caller's own device map**. Another user's device is unaddressable rather than addressable-and-rejected; keep it that way instead of adding an ownership check.
- A command's acknowledgement comes from the target device, relayed back to the sender. `{ ok: true }` must continue to mean the device accepted it, not that the server forwarded it.
- Everything arriving from a socket is untrusted: validate through `types.ts` rather than casting at the call site.
- Progress persistence is **not** here. It belongs to `POST /playback/sessions/:id/progress`; `playback:state` is live status only, and is never written to the database.
- Inbound state reports are rate limited per socket (`MAX_STATE_REPORTS_PER_SECOND`).
- The client-side counterpart lives in `Oblecto-Web/src/remote/`.
