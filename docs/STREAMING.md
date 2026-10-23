# Streaming operation and migration

The shared playback engine serves Oblecto Web, Emby/Jellyfin and federated media. Requires FFmpeg/ffprobe on the configured executable paths (or PATH). The software baseline uses libx264, AAC, libass, zscale and tonemap. Source probing and keyframe analysis are cached in memory; streaming caches are disposable. Migration `0010-playback-markers` adds per-file chapter, segment and thumbnail metadata.

In Oblecto Web, **Available files → Copy stream URL** requests direct original-file delivery (`forceDirect: true`) for external players. The copied HTTP URL serves the unchanged file with byte-range support, including MKV, HEVC and surround audio, without conversion. The external player selects embedded audio/subtitle tracks and must decode the source formats. The link expires after the configured idle timeout (30 minutes by default), or when its session is stopped or the server restarts; media requests refresh the idle timeout. Regular web playback still negotiates compatible delivery.

## Preparation and startup latency

Media probes and remux keyframe timelines are cached by file version. Timeline keys include the file path, device/inode, size, modification time, duration and video stream. Concurrent sessions share scans, track/position updates reuse them, and changed files are scanned again. The timeline cache retains at most 128 entries and retries failed scans. Cancelling one session stops its wait without cancelling a scan shared with another session; server shutdown cancels outstanding scans.

Session descriptors and Settings → Server status expose `timings`: file lookup/authentication, statistics initialization, media probing, playback planning, total preparation, first media delivery and reported browser startup, in milliseconds. Preparation phases include scheduler/shared-work waiting. `startupMs` now includes preparation and ends at the first successful original-file or segment byte, excluding HEAD, manifests and failed requests. Browser startup runs from the play action through the first `playing` event, including title metadata and deferred player loading, and is sent as optional `firstPlaybackMs` progress telemetry. These diagnostics last for the session; they are not stored in viewing history. Browser timing is client-reported and may include autoplay delays.

## Configuration

Under `streaming` in the existing configuration:

| Setting | Default | Meaning |
| --- | --- | --- |
| `encodingConcurrency` | 2 | Maximum concurrent preparation jobs |
| `maxQueue` | 64 | Maximum waiting jobs; requests beyond this receive 503 |
| `cacheBytes` | 10737418240 | Generated-media cache budget, 10 GiB |
| `cacheDirectory` | OS temp directory + `oblecto-playback` | Parent of isolated per-process caches |
| `idleTimeoutMs` | 1800000 | Thirty-minute idle session lease |
| `vaapiDevice` | `/dev/dri/renderD128` | Device used when VAAPI encoding is configured |
| `defaultTargetLanguageCode` | `eng` | Default audio/subtitle language preference |

Limit values must be positive safe integers. The old `hlsMaxSegmentLead` setting is obsolete. Prefetch is bounded to two segments; active readers pin cache files. Expired/stopped sessions release assets and cancelled encoders are awaited. On startup the cache removes run directories whose recorded process no longer exists, and leaves other running servers' directories alone.

`transcoding.hardwareAcceleration` and `hardwareAccelerator` retain NVIDIA (`cuda`) and VAAPI selection. The server checks the encoder list, attempts hardware encoding, then retries once with software and disables the failing hardware backend for that process. Hardware performance/driver compatibility must be validated on the deployment machine. `transcodeEverything` is superseded by negotiated capabilities and explicit quality requests.

Adaptive output is H.264/AAC MPEG-TS at 360p/800 kbps, 480p/1.4 Mbps, 720p/2.8 Mbps and 1080p/5 Mbps, plus 128 kbps stereo audio. Resolutions above the source are omitted; smaller sources get a native-height low rendition. Video transcoding normalizes to 30 fps with aligned four-second boundaries. This bounds implementation complexity for the initial adaptive ladder. Original delivery preserves source frame rate/resolution/HDR. Remux delivery follows actual keyframe boundaries. HDR transcodes are tone-mapped to SDR. Text subtitles use WebVTT; ASS/SSA and bitmap subtitles are burned in. Changing selected tracks creates a new revision and resumes at the absolute position.

The queue schedules waiting sessions fairly. This is on-demand encoding, so slow CPUs can still buffer; diagnostics expose startup time, encoding speed, queue depth and buffering reports. A 60-second preparation deadline produces an actionable error instead of an indefinite wait. The browser bounds network retries and decoder recovery, and falls back once to HLS when direct playback fails or stalls without advancing.

## Federation

Federation setup, mutual pairing and metadata protocol v2 are documented in [Federation](FEDERATION.md). Upgrade both metadata peers together. The existing TLS media port and configured trust/key material are retained. Media protocol v1 uses a random RSA challenge inside the verified TLS connection. Each frame has a four-byte big-endian body length, a four-byte JSON-header length, a JSON header, and optional raw media bytes. Frames are limited to 1 MiB; headers to 64 KiB; media chunks to 32 KiB.

Operations are `hello`/`authenticate`, `create`, `update`, `heartbeat`, `serve`, `stop`, and `cancel`. Request IDs associate results and streaming frames. The owning server validates that requested files are local and generates output. The receiving server proxies bytes and rewrites playlist tokens to its own scoped lease; it never transcodes the resulting stream again. Backpressure, request cancellation, idle request deadlines, and disconnect cleanup are propagated. Peer authentication has a ten-second deadline. Media requests have a sixty-second inactivity deadline.

Oblecto control/session APIs are breaking changes; see [API.md](API.md). Emby/Jellyfin public endpoint shapes remain compatible, while the implementation delegates negotiation and delivery to the same engine. Returned URLs stay on the Emby server and do not expose source paths.

## Verification

- `npm run test:mocha` runs the unit tests, including the playback planner, lifecycle, HTTP and real FFmpeg tests. Tests that call the real metadata services are separate, in `npm run test:network`.
- `npx mocha --extension ts --require tsx tests/mocha/playbackEngine.spec.ts tests/mocha/playbackFederation.spec.ts tests/mocha/streamingSessionCreate.spec.ts tests/mocha/embyItems.spec.ts tests/mocha/embySessionsPlayingProgress.spec.ts tests/mocha/realtimePlaybackLifecycle.spec.ts` runs the focused backend suite. Federation tests also require OpenSSL.
- `npx playwright install --with-deps chromium firefox webkit`, then `npm run test:playback:browser`, runs real generated media through the production browser playback controller and server. Fixtures, keys and cache data use temporary directories; test servers do not use a live library/database.
- `npm run test:startup` checks the built server’s SIGINT/SIGTERM shutdown and the TUI lifecycle using temporary configuration and databases.
- `npm --prefix Oblecto-Web run build` checks the web bundle. `npm run build` also installs frontend dependencies as defined by the repository's release command.

Before release, manually check actual Safari/iOS and Jellyfin web/Media Player: original playback, resume, forward/backward seeks, bandwidth-constrained adaptive playback, audio and text/ASS/bitmap subtitle changes, pause across idle periods, concurrent viewers and stop cleanup. Test configured GPUs and representative HDR material on deployment hardware. WebKit automation is not a substitute for actual iOS device acceptance. Deployment is not performed by these tests.

## Chapters, seek thumbnails and skip controls

New local movie and episode files receive low-priority analysis after identification. For existing files, use Settings → Maintenance → Analyse playback, or `POST /api/v1/system/maintenance` with `{ "action": "analyse", "target": "all" }`. Analysis fills missing data and preserves manually set segments. Playback works while analysis is pending; reopening a session picks up completed analysis.

FFprobe reads chapter times and titles. Recognised chapter titles identify intros, credits, recaps and previews. For episodes of at least five minutes, FFmpeg's chromaprint muxer compares audio with nearby episodes in the same season to find shared intros and credits. A lone episode waits for another episode; unavailable chromaprint falls back to chapter titles. Detection is approximate and depends on shared audio; use the file segment API to correct ranges. Movies use chapter titles, without fingerprint comparison.

`streaming.trickplay` and `streaming.detectSegments` default to true. `streaming.trickplayInterval` defaults to 10 seconds and accepts integers from 1 to 60. Thumbnails are 320 pixels wide, preserve display aspect ratio, and are packed into 10×10 JPEG sheets under `assets.trickplayLocation` (default `/etc/oblecto/assets/trickplay/`). Generation uses keyframes and fills the tail with the last available frame; HDR is tone mapped when supported. Thumbnail sheets are removed when their file record is cleaned up. Analysis processes are cancelled and awaited during shutdown.

Oblecto Web shows chapter boundaries and chapter names on the seek bar, chapter navigation in Playback settings, and thumbnail previews while hovering or dragging. Skip buttons seek to the end of intro, credit, recap or preview ranges. Episode autoplay uses terminal detected credits as its countdown start; a credits sequence followed by another scene can be skipped without jumping over that scene. With no credit markers it retains the 30-second countdown lead; with known credits followed by another scene, autoplay waits until playback ends. Missing thumbnails fall back to time-only previews. Federated playback currently supplies no markers or thumbnails.

Jellyfin item details expose `Chapters`, `Trickplay`, and media source `HasSegments`. Authenticated image-sheet and image-playlist routes serve thumbnails; `/MediaSegments/{itemId}` returns segments with seconds converted to ticks, and accepts file media source IDs used by jellyfin-web. The client's own segment preferences determine prompting or automatic skipping.

## Viewing telemetry

`POST /playback/sessions/:id/progress` continues to accept `revision`, `position`, `paused` and
`buffering`. The native player also sends optional `sequence` (increasing nonnegative integer),
`activeSeconds` (cumulative active wall-clock seconds), `playedRanges` (cumulative `[start,end]`
media-second pairs, at most 1024), and `playbackRate`. These counters continue across revisions of
one managed session. `failed: true` records a terminal client playback error as `CLIENT_FAILED`.
Older clients can omit the additions; their viewing is estimated from successive progress reports.

The native player samples monotonic elapsed time on player events, accumulates the browser's played
ranges, and reports transitions plus the existing 10-second heartbeat. Server checks bound elapsed
credit, sequence ordering, media ranges, and revision changes. Ranges merge for distinct coverage;
a seek changes resume position without claiming the skipped part. Statistics remain client-reported
estimates, not proof that a person watched. Stop/timeout/shutdown add no unreported time; sessions
unfinished at startup are marked interrupted. Resume state and manual watched changes remain independent.
See [API statistics](API.md#statistics) for metric definitions and retention.
