# Realtime API Documentation

The Realtime API in Oblecto is built on top of [Socket.IO](https://socket.io/). It carries library notifications, seedbox import progress, and the whole of remote play: device discovery, playback commands, and the playback state devices report back.

- **Transports:** `websocket`, `polling`
- **Origins:** `*:*` (All origins allowed)

Use a Socket.IO 4-compatible client on the **native HTTP server** (default port 8080), default namespace `/`, path `/socket.io/`. This is not a plain WebSocket protocol or the Jellyfin `/socket` endpoint. Reverse proxies must expose the Socket.IO path under any configured prefix. Socket.IO origin handling is separate from the REST [CORS policy](API.md#desktop-transport-and-cors).

See the [desktop client guide](DESKTOP_CLIENTS.md#realtime-updates-and-remote-playback) for integration. The [wire types and validators](../src/lib/realtime/types.ts) are the exact event schema. All event names are case-sensitive.

| Event | Direction | Scope | Acknowledgement |
| --- | --- | --- | --- |
| `devices` | Server → client | Current user's devices | None |
| `playback:state` | Client → server | Reporting device | None; malformed/excess reports dropped |
| `remote:command` | Both | Commands within current user's devices | Required for command outcome |
| `indexer` | Server → client | Broadcast to all authenticated sockets | None |
| `media:progress` | Server → client | Affected user's sockets | None |
| `seedbox` | Server → client | Broadcast to all authenticated sockets | None |

## Connection and authentication

Authentication happens in the **handshake**, not in a post-connect event. A socket that fails to authenticate never reaches the server's connection handler, so there is no window in which a connected socket has no user.

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:8080", {
  auth: cb => cb({
    token: "eyJhbG...",
    device: {
      id: "5f1c…",                          // stable, persisted by the client
      name: "Firefox on Linux",
      capabilities: ["control", "playback"]
    }
  })
});
```

### `auth.token`

A valid JWT obtained from `POST /auth/login`. A missing, malformed or unverifiable token fails the handshake with `connect_error`.

Expiry and credential changes are checked at handshake/reconnect, not periodically on an established socket. Disconnect on local logout or an HTTP authentication failure. Supply the latest token when reconnecting. Do not send a post-connect `authenticate` event.

### `auth.device`

| Field | Type | Notes |
|---|---|---|
| `id` | string | **Required.** Client-generated and persisted (Oblecto-Web keeps a UUID in `localStorage`). This, not the Socket.IO socket id, is how a device is addressed — it must survive reloads, or a selected playback target goes stale every time the target refreshes. Truncated to 128 characters. |
| `name` | string | Human-meaningful, shown in the device picker. Trimmed and truncated to 64 characters; defaults to `"Unnamed device"` when absent. |
| `capabilities` | string[] | Any of `"control"`, `"playback"`. `"control"` is always implied. **Only devices declaring `"playback"` are offered as playback targets**, which is what keeps headless integrations out of the picker. |

If two sockets claim the same `id` for one user, the newest wins and the older is disconnected. Overlapping replacement preserves the prior state/connection time, while the new handshake supplies the name and capabilities. A normal disconnect removes the registry entry; a later reconnect starts with idle state. Republish actual player state after every connection. The stable ID lets controllers keep the same target identity across both cases.

Because `auth` is re-evaluated by Socket.IO on every reconnect, changing the stored name and reconnecting is enough to rename a device.

## Remote play

### Server → Client: `devices`

The caller's own devices, pushed on connect and again whenever anything changes — a device joining or leaving, a rename, or a state report. There is no subscription to manage and nothing to poll.

```json
[
  {
    "deviceId": "5f1c…",
    "name": "Living room TV",
    "capabilities": ["control", "playback"],
    "isSelf": false,
    "connectedAt": 1758057600000,
    "state": {
      "status": "playing",
      "media": { "kind": "episode", "id": "1421", "title": "Blink", "subtitle": "Doctor Who" },
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

A device only ever appears in its own owner's list.

### Client → Server: `playback:state`

Reported by a playing device. The payload is a `PlaybackState` **without** `updatedAt` — the server stamps that itself, because device clocks disagree and a controller extrapolates the position from it between reports.

| Field | Type | Notes |
|---|---|---|
| `status` | string | `idle`, `playing`, `paused`, `buffering`, `blocked`, `error`. `blocked` means the browser refused autoplay and needs a gesture on that device — without it, that failure is invisible from another room. |
| `media` | object \| null | `{ kind: "episode" \| "movie", id, title?, subtitle? }`. Null when idle. |
| `position`, `duration` | number | Seconds. |
| `volume` | number | 0.0–1.0. |
| `muted` | boolean | |
| `canSeek`, `canSetVolume`, `hasNext` | boolean | Let a controller hide controls the target cannot honour. `canSetVolume` is false where the browser ignores `video.volume`, iOS Safari among them. |
| `error` | string | Optional, for `status: "error"`. |

Reports are rate limited to **10 per second per device**; the excess is dropped. Report on every transition, and about once a second while playing.

`media.id` must be a nonempty **string** containing a native movie/episode ID (not a file ID). Media title/subtitle are optional display strings, each limited to 256 characters; error text is limited to 512. Device `connectedAt` and server-stamped state `updatedAt` are epoch milliseconds. A new idle snapshot has `updatedAt: 0`; do not extrapolate it. Clamp extrapolated positions to duration and allow for clock skew. These reports do not extend a managed playback lease or save watch progress; use the HTTP progress endpoint too.

### Client → Server: `remote:command`

Sends a command to another of *your own* devices. Takes a Socket.IO acknowledgement.

```javascript
socket.emit("remote:command", {
  targetDeviceId: "5f1c…",
  command: { type: "play", media: { kind: "movie", id: "42" } }
}, ack => {
  if (!ack.ok) console.error(ack.code, ack.error);
});
```

| Command | Payload |
|---|---|
| `play` | `{ type, media: { kind, id }, position? }` |
| `pause` / `resume` / `stop` / `next` | `{ type }` |
| `seek` | `{ type, position }` — seconds |
| `setVolume` | `{ type, volume }` — 0.0–1.0 |
| `setMuted` | `{ type, muted }` |
| `rename` | `{ type, name }` — the target persists it and re-announces |

The acknowledgement is `{ ok: true }`, or `{ ok: false, code, error }` with `code` one of:

| Code | Meaning |
|---|---|
| `invalid` | The envelope or command failed validation. |
| `unknown_device` | No such device **among the caller's own**. Another user's device reports this too: targets are resolved inside the caller's own device map, so cross-user addressing is indistinguishable from addressing nothing. |
| `unsupported` | The target did not declare the `playback` capability. |
| `timeout` | The target did not answer within 5 seconds. |
| `failed` | The target rejected the command. |

`ok: true` means the **target device** accepted the command, not merely that the server relayed it.

### Server → Client: `remote:command`

Delivered to the target. Answer the acknowledgement callback with a `CommandAck` — that answer is what the controlling device sees.

```javascript
socket.on("remote:command", async ({ from, command }, ack) => {
  // from: { deviceId, name } — who is driving this device
  try {
    await player.acceptCommand(command); // App-defined; accept within 5 seconds.
    ack({ ok: true });
  } catch (error) {
    ack({ ok: false, code: "failed", error: error.message || "Command failed" });
  }
});
```

Accept or reject promptly; lengthy preparation can continue after acceptance, with state updates reporting the outcome. A target's non-success acknowledgement is relayed as `failed`; a missing acknowledgement becomes `timeout`. A controller should allow slightly more than five seconds for the server round trip. Do not automatically replay timed-out commands: the target may have acted. Rename updates the server registry before delivery; the target must persist the new name or a later handshake will overwrite it.

## Library and import events

### Server → Client: `indexer`

Emitted when content is added, identified, or its metadata finishes updating in the library. Clients coalesce these events and refresh current lists and detail resources without discarding filters or loaded pages. On reconnect, clients refetch those resources to recover missed events.

```json
{ "event": "updated", "type": "movie", "id": 42 }
```

`event` is `added`, `updated` or `artwork`; `type` is `series`, `episode` or `movie`.

It is also emitted when a file is flagged as problematic, or when its problem clears after a successful retry or rescan:

```json
{
  "event": "problem",
  "fileId": 42,
  "problematic": true,
  "problemStage": "identify",
  "error": "Could not identify: /media/Movies/zzqx.mkv (TmdbMovie: ...)"
}
```

`problemStage` is `identify`, `probe` or null; `error` can be null after clearing. `fileId` is a file ID, not a media ID.

### Server → Client: `media:progress`

Sent after playback progress or a manual watched/unwatched change is persisted, including changes made by Jellyfin-compatible clients. Only sockets authenticated as the affected user receive it. No subscription is required.

```json
{
  "type": "episode",
  "id": 42,
  "track": { "time": 600, "progress": 0.25, "updatedAt": "2026-09-22T12:00:00.000Z" }
}
```

`type` is `movie` or `episode`. Manual watched changes use time `0` and progress `1` or `0`. Clients merge by timestamp, update visible cards immediately, and refresh Continue Watching, Next Up, and watched filters when membership changes. Live device snapshots still provide playback positions between saves; they do not persist progress.

### Server → Client: `seedbox`

Status of seedbox imports.

```json
{
  "event": "import_progress",
  "seedbox": "Seedbox Name",
  "origin": "/remote/path/file.mkv",
  "destination": "/local/path/file.mkv",
  "transferred": 102400,
  "total": 104857600,
  "progress": 0.0009765625
}
```

`event` is `import_start`, `import_progress`, `import_success` or `import_error`. `transferred` and `total` are bytes; `progress` is a fraction. Those three fields appear only on `import_progress`; `error` text only on `import_error`. Origin/destination are server-side paths, not URLs for desktop clients.

## Reconnection and cache refresh

There is no replay cursor, durable event log or subscribe/unsubscribe API. Reconnect automatically for network failures, then refetch visible lists/details and current-user state to recover missed changes. Authentication failures require fixing the token/device handshake before retrying. Coalesce indexing events rather than refreshing every list for each item. `indexer` and `seedbox` broadcasts are not gated by management permissions; management mutations still require their HTTP permissions.

There are no native socket events for account preference, favourite, watchlist or maintenance-job changes. Update local state from mutation responses and refetch on focus/reconnect; poll maintenance jobs when needed. On disconnect remove unavailable targets from the device picker without treating a socket disconnect as proof playback stopped. HTTP session lifetime is independent.

## Removed

These were part of the previous remote play implementation and no longer exist:

| Removed | Replacement |
|---|---|
| `authenticate` (C→S) | Handshake `auth`. |
| `play` (S→C) | `remote:command` with `{ type: "play" }`. |
| `playing` (C→S) | Progress is persisted through `POST /playback/sessions/:id/progress`; `playback:state` reports live state but is not written to the database. |
| `GET /clients` | The `devices` event. |
| `POST /client/:clientId/playback` | `remote:command`. |

## Error handling

- A failed handshake surfaces as `connect_error` on the client, with a message explaining which part was rejected.
- Malformed `playback:state` payloads are logged and dropped.
- Malformed commands are answered with `{ ok: false, code: "invalid" }`.
