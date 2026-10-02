# Federation

Federation lets explicitly trusted Oblecto servers browse and play each other’s local libraries. Pairing grants access to the entire local library. It does not share user accounts, watch history, filesystem paths, or media files on disk. Playback and transcoding run on the server that owns the media; the receiving server proxies the result.

## Upgrade

Upgrade both ends together. Metadata protocol **2** replaces the old newline protocol; there is no legacy fallback. Media protocol **1** remains compatible. Existing `federation.servers` aliases and `clients` public-key paths continue to work. Keep aliases unchanged: imported files use them as their stable origin identifier.

The new append-only database migration creates `FederationRecords` for pairing progress, invitation hashes, catalog staging, item identities and last synchronization status. Existing imported catalogs remain available while peers upgrade. A completed v2 snapshot repairs their associations and reconciles deleted files. Back up configuration, database and identity material before upgrading as usual.

## Guided setup and mutual pairing

1. Open **Settings → Federation** on each server. Enter its reachable DNS hostname or IP address, metadata port (default 9131), and media port (default 9132).
2. Choose **Prepare identity**. Existing identity files are preserved. Missing RSA keys and TLS certificates are created beneath `federation/` beside the active configuration file. Certificate creation requires OpenSSL. New certificates last one year and contain the supplied hostname/IP address.
3. Enable federation and choose **Save and apply**. Both servers must be able to reach each other’s metadata and media ports. Check that listeners report “Running”.
4. On one server, create an invitation. Paste it into the other server and choose **Pair and share libraries**. The invitation is a bearer credential: send it through a trusted channel. It expires after ten minutes and can be revoked before use.
5. Pairing validates the invitation’s certificate, proves both identities and checks a callback connection before establishing mutual trust. Inspect pairing progress and synchronization status on both servers.

Invitations contain public identity material and a random one-time secret. Only a hash of that secret is persisted on the issuer. Prepared pairing operations recover after restart and retry every thirty seconds until expiration. Expired or cancelled pending operations cannot authorize catalog access. A completed relationship persists until explicitly revoked. If one server completed while the other became unavailable, inspect both sides and remove the completed peer if abandoning the pairing.

Certificates are verified against the configured hostname and trusted certificate. Replacing a paired certificate or key requires revoking the existing trust and pairing again. Identity private keys are never returned by the administration API. Managed identity directories are owner-only; private keys are created with mode 0600.

## Manual configuration

Manual outbound peers remain supported in `federation.servers`:

```json
{
  "home": {
    "address": "home.example",
    "dataPort": 9131,
    "mediaPort": 9132,
    "ca": "/etc/oblecto/trust/home.crt",
    "uuid": "remote-server-uuid",
    "name": "Home library",
    "enabled": true
  }
}
```

`uuid`, `name`, and `enabled` are optional for legacy entries. On the origin, add the receiving server’s UUID to `federation.clients` with `{ "key": "/path/to/receiver-public-key.pem" }`. Paired entries also include `fingerprint`, the SHA-256 certificate fingerprint, which pins the exact certificate on both ports. Manual entries may omit it when trusting a certificate authority. The UI provides both outbound peer configuration and incoming authorization. Authorize the reverse direction to share mutually without invitations.

All federation changes apply live. The service reconnects changed peers and restarts affected listeners. A saved configuration that cannot start is reported separately from running state, allowing correction without restarting Oblecto. Disabling federation blocks new remote playback and closes federation activity. Revoking an incoming client closes its active media and metadata connections.

## Synchronization and recovery

Each peer synchronizes independently on connection, on **Sync now**, and every fifteen minutes. `syncIntervalMs` can be set from 1000 through 86400000 milliseconds. Transient failures retry with exponential backoff and jitter, capped at sixty seconds. Connections and authentication have ten-second deadlines; requests have sixty-second inactivity deadlines.

The origin captures a consistent snapshot in database staging, exporting locally owned files and all their movie/episode associations. Pages are bounded to 100 records and approximately 48 KB. Metadata includes identities, titles, descriptions, dates, episode numbering and basic file properties. No filesystem source paths are exported. Unidentified local files and imported remote files are excluded.

The receiver stages and validates the complete snapshot before applying it transactionally. Disconnects, malformed pages and incomplete snapshots preserve the previous catalog. Successful snapshots add/update remote files, repair associations and remove files no longer exported by that peer. Provider identities merge matching catalog entries; items without provider identifiers retain peer-scoped identities. Existing catalog metadata is preserved for shared matches; items created by a peer follow its metadata updates. Artwork enrichment is queued after import and is not required for browsing.

Remote files are excluded from local filesystem cleanup. Removed remote file links do not delete media identities or watch history. Removing a peer retains its cached imported files by default; select **Also remove its imported file records** to purge them. Either way, playback is unavailable without configured, enabled trust. A disconnected peer’s cached catalog remains browsable.

Snapshot staging expires after one hour. Completed imports and disconnected exports are cleaned promptly. Runtime socket state is not persisted; last successful synchronization and pairing state are persisted.

## Protocol

Metadata uses the same bounded framing utility as media: four-byte big-endian body length, four-byte JSON header length, JSON header, and optional raw bytes. Metadata does not permit raw bytes. The total body limit is 1 MiB and the JSON header limit is 64 KiB.

Messages contain `{ "id": "request-id", "op": "operation", "payload": {} }`. Replies use `result` with `payload`, or `error` with `message`.

- `hello` accepts `{ version: 2 }` and returns a random nonce and server UUID.
- `authenticate` accepts UUID and an RSA/SHA-256 signature over `oblecto-federation-v2:authenticate:<nonce>`. Only configured clients or prepared pairing identities may authenticate; only active client authorization permits catalog operations.
- `identity` supports callback proof over a separately domain-separated nonce. It cannot generate an authentication signature.
- `pair` claims an invitation and verifies callback identity; `pair.commit` completes authenticated prepared trust.
- `snapshot.start` returns `{ snapshot, count }`.
- `snapshot.page` accepts `{ snapshot, offset }` and returns `{ snapshot, offset, items, complete }`, where the returned offset is the next record position. Only the snapshot created on that authenticated connection is accessible.

## Troubleshooting and checks

Connection errors identify unreachable peers, certificate/hostname failures, identity material problems, protocol incompatibility or invalid snapshots. Inspect both servers’ pairing and peer status. A successful connection test checks metadata TLS and authorization; actual playback also requires the media port to be reachable.

Run `npm run verify` and the federation browser tests. Backend tests generate temporary certificates and media, use isolated databases, and cover two real server processes, mutual pairing, playback, recovery and deletion. They require OpenSSL, FFmpeg and ffprobe. Frontend verification must use `OBLECTO_WEB_DIST_ROOT` pointed at a temporary directory to avoid publishing to a running installation.
