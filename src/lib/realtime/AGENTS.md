# Realtime Socket Interface (src/lib/realtime/)

What lives here
- `types.ts`: The wire protocol — payload types, event constants, and a runtime validator per inbound shape. Depends on nothing else in the tree, so tests can import it cheaply.
- `DeviceRegistry.ts`: In-memory directory of connected devices, keyed by user and then by device id. Knows nothing about Socket.IO; it holds sockets opaquely and hands them back to the controller.
- `RealtimeController.ts`: Owns the Socket.IO server, the handshake authentication middleware, the registry, and `dispatchCommand` — the single authorization chokepoint for remote play.
- `RealtimeClient.ts`: One authenticated socket. Handles `playback:state` and `remote:command`, and delivers commands to its own device.

Other events
- `RealtimeController.broadcast` sends library (`indexer`) and seedbox (`seedbox`) events to every socket.
- `publishProgress` sends `media:progress` to the affected user's sockets only, whenever `progressEvents` reports saved progress.

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

## Completion: commit and push

- Unless the user explicitly asks otherwise, completing a task includes committing and pushing all
  working-tree changes, including pre-existing edits and new files. This is standing authorization;
  do not ask for separate confirmation to commit or push.
- Run checks appropriate to the changes, preserve existing work, stage all repository changes, and
  create a descriptive commit. Push the current branch to its configured remote without force.
- Commit and push changed submodules first, then commit and push the parent repository with the
  updated submodule references.
- When multiple agents share a checkout, coordinate one final commit and push after all workers
  finish their changes.
- Verify that the push succeeded and the working trees are clean. Report the commit IDs and any
  check or push failures.
