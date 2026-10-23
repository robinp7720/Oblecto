# Streaming operation and migration

The shared playback engine serves Oblecto Web, Emby/Jellyfin and federated media. Requires FFmpeg/ffprobe on the configured executable paths (or PATH). The software baseline uses libx264, AAC, libass, zscale and tonemap. Source probing and keyframe analysis use bounded memory caches and versioned per-file preparation metadata; streaming caches are disposable. Migration `0010-playback-markers` adds per-file chapter, segment and thumbnail metadata.

In Oblecto Web, **Available files → Copy stream URL** requests direct original-file delivery (`forceDirect: true`) for external players. The copied HTTP URL serves the unchanged file with byte-range support, including MKV, HEVC and surround audio, without conversion. The external player selects embedded audio/subtitle tracks and must decode the source formats. The link expires after the configured idle timeout (30 minutes by default), or when its session is stopped or the server restarts; media requests refresh the idle timeout. Regular web playback still negotiates compatible delivery.

## Preparation and startup latency

Unset account quality preferences now use **Auto**. Explicit Original and fixed-height preferences are preserved. Auto starts with the lowest available rendition, then hls.js increases quality when bandwidth permits. The startup rendition is held until the first `playing` event, avoiding WebKit losing its initial frames during an early resolution switch. The browser targets 30 seconds ahead, caps forward buffering at 60 seconds and keeps 30 seconds behind. Original remains available for compatible direct playback and external-player links.

Migration `0017-playback-preparation` adds nullable preparation metadata on Files. Background playback analysis stores probes and keyframe timelines together with the source path, device/inode, size, modification time and configured probe executable. Playback verifies that identity before reuse, including after restart. Preparation data is excluded from ordinary library queries and loaded only when needed by playback. Changed or missing metadata uses the safe live preparation path and queues background refresh. Existing libraries can populate metadata through **Analyse playback**. Full-file keyframe scans remain necessary for uncached remux sources; transcoded adaptive playback does not require them.

Media probes and remux keyframe timelines are cached by file version. Timeline keys include the file path, device/inode, size, modification time, duration and video stream. Concurrent sessions share scans, track/position updates reuse them, and changed files are scanned again. The timeline cache retains at most 128 entries and retries failed scans. Cancelling one session stops its wait without cancelling a scan shared with another session; server shutdown cancels outstanding scans.

Session descriptors and Settings → Server status expose `timings`: file lookup/authentication, statistics initialization, media probing, playback planning, total preparation, first media delivery and reported browser startup, in milliseconds. Preparation phases include scheduler/shared-work waiting. `startupMs` now includes preparation and ends at the first successful original-file or segment byte, excluding HEAD, manifests and failed requests. Browser startup runs from the play action through the first `playing` event, including title metadata and deferred player loading, and is sent as optional `firstPlaybackMs` progress telemetry. These diagnostics last for the session; they are not stored in viewing history. Browser timing is client-reported and may include autoplay delays.

## Configuration

Under `streaming` in the existing configuration:

| Setting | Default | Meaning |
| --- | --- | --- |
| `encoderMode` | `segment` | Per-segment encoding, or opt-in `window` sequential production; restart after changing configuration |
| `encodingConcurrency` | 2 | Maximum concurrent preparation jobs |
| `maxQueue` | 64 | Maximum waiting jobs; requests beyond this receive 503 |
| `cacheBytes` | 10737418240 | Generated-media cache budget, 10 GiB |
| `cacheDirectory` | OS temp directory + `oblecto-playback` | Parent of isolated per-process caches |
| `idleTimeoutMs` | 1800000 | Thirty-minute idle session lease |
| `vaapiDevice` | `/dev/dri/renderD128` | Device used when VAAPI encoding is configured |
| `defaultTargetLanguageCode` | `eng` | Default audio/subtitle language preference |

Limit values must be positive safe integers. The old `hlsMaxSegmentLead` setting is obsolete. In segment mode, prefetch is bounded to two segments and begins before delivery completes. Demand is scheduled ahead of queued prefetch, with round-robin fairness among viewers at the same priority; background work leaves a slot available when concurrency exceeds one. Active jobs finish or are cancelled before their slot is reused; active readers pin cache files. Expired/stopped sessions release assets and cancelled encoders are awaited. On startup the cache removes run directories whose recorded process no longer exists, and leaves other running servers' directories alone.

`transcoding.hardwareAcceleration` and `hardwareAccelerator` retain NVIDIA (`cuda`) and VAAPI selection. The server checks the encoder list, attempts hardware encoding, then retries once with software and disables the failing hardware backend for that process. Hardware performance/driver compatibility must be validated on the deployment machine. `transcodeEverything` is superseded by negotiated capabilities and explicit quality requests.

Adaptive output is H.264/AAC MPEG-TS at 240p/300 kbps, 360p/800 kbps, 480p/1.4 Mbps, 720p/2.8 Mbps and 1080p/5 Mbps, plus 128 kbps stereo audio. Resolutions above the source are omitted; smaller sources get a native-height low rendition. Video transcoding normalizes to 30 fps with aligned two-second boundaries. This bounds implementation complexity for the initial adaptive ladder. Original delivery preserves source frame rate/resolution/HDR. Video-copy delivery follows actual keyframe boundaries. Compatible H.264 video is copied when only audio needs AAC conversion, avoiding video encoding and preserving its source frame rate. A bitrate ceiling alone does not force conversion when the source fits. HLS bandwidth declarations include audio and a 10% transport/peak allowance; CODECS describes the actual output. HDR transcodes are tone-mapped to SDR. Text subtitles use WebVTT; ASS/SSA and bitmap subtitles are burned in. Changing selected tracks creates a new revision and resumes at the absolute position.

With `encoderMode: "window"`, each requested transcoded rendition produces at most six two-second segments per FFmpeg run. Completed files are published to the shared cache while the producer continues. Renditions are generated on demand. Cache readers pin published files; complete-cache admission is serialized, and temporary staging is bounded to one 12-second window per active viewer producer. Moving outside a window or changing rendition cancels the old producer before its replacement starts. Revision changes, stop and shutdown await subprocess exit, cache publication and temporary-directory cleanup. Remux/audio-only delivery continues using verified source boundaries and the segment producer.

The default remains `segment` until comparative performance acceptance passes. Set `encoderMode` back to `segment` and restart to roll back sequential production. The modes use the same URLs and session lifecycle.

The queue schedules waiting sessions fairly. This is on-demand encoding, so slow CPUs can still buffer; diagnostics expose startup time, encoding speed, queue depth and buffering reports. Session diagnostics add `operations` (video/audio copy, encode or none) and `delivery`: latest queue wait and generation time in milliseconds, reported buffered seconds, and cumulative reported rebuffer duration in milliseconds. Rebuffer duration excludes initial startup, seeking and intentional pause. Missing client telemetry starts at zero; these counters are transient and are not persisted as viewing history. A 60-second preparation deadline produces an actionable error instead of an indefinite wait. The browser bounds network retries and decoder recovery, and falls back once to HLS when direct playback fails or stalls without advancing.

## Performance acceptance

Run `npm run benchmark:playback -- --baseline-ref <commit> --runs 5 --play-seconds 8` from the repository root. The harness archives the specified backend and matching frontend submodule revision into a temporary directory, then compares that baseline, current segment mode and window mode using synthetic 720p H.264/AAC media. It uses Chromium network emulation at 0.75, 1.5, 3 and 10 Mbps with 100 ms latency; Original is compared at 10 Mbps. JSON lines report first playback, cumulative rebuffering, selected height, failures and p95/mean summaries. Browser code is loaded before throttling, so this measures the media pipeline rather than deferred application download. One initial cold preparation is followed by warm preparation; OS file caches are not flushed. Use an idle machine and more runs for release acceptance.

Before changing the default to window mode, require at least 20% lower p95 adaptive startup and 50% less rebuffer duration than the recorded baseline in constrained-network cases with measurable buffering; direct startup must stay within 10%, with no new playback failures. Also verify concurrent viewers, mid-playback bandwidth drops, cache pressure and actual Safari/iOS, Jellyfin clients, subtitles/HDR and configured GPUs. A short synthetic benchmark alone does not satisfy that release gate.

### Initial measurements

An exploratory run on 23 October 2026 compared baseline `9dbf52f60d0bd42e1b7ff788c2c1c1301e4e9b25` and its pinned web client with the candidate, using three trials per mode, 100 ms latency and the first eight seconds of playback. At this sample size, p95 is the largest sample:

| Connection / metric | Baseline | Segment mode | Window mode |
| --- | ---: | ---: | ---: |
| 0.75 Mbps Auto startup p95 | 6.57 s | 2.15 s | 2.03 s |
| 0.75 Mbps mean rebuffer time | 3.83 s | 0 s | 0 s |
| 1.5 Mbps Auto startup p95 | 3.65 s | 1.35 s | 1.28 s |
| 1.5 Mbps mean rebuffer time | 0 s | 0.011 s | 0 s |
| 10 Mbps Original startup p95 | 0.665 s | 0.666 s | 0.663 s |

There were no playback failures. Auto used the new 240p rendition on the 0.75 Mbps link versus the baseline's 360p minimum, so these results include the intended startup-quality tradeoff. They do not establish a fixed-quality encoding speedup or satisfy the broader release gate. Automated regression checks also cover both modes at 3 and 10 Mbps, a bandwidth drop, and basic playback/seek/retry on Chromium, Firefox and WebKit; bandwidth emulation itself is Chromium-only.

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
