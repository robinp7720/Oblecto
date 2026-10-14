# Oblecto API response models

Use these wire shapes with the [REST reference](API.md) and [endpoint index](API_ENDPOINTS.md). The native API often serializes database models directly. Fields listed here describe available metadata; they are not a guarantee that every list includes every association. Decode unknown fields permissively, retain nullable values, and fetch detail resources before playback.

## IDs and units

| Value | Representation |
| --- | --- |
| Native movie, series, episode, file, person, set, user, group ID | Integer; namespace by server and entity kind |
| Playback `sessionId`, job ID, cursors, device ID | Opaque string |
| Realtime `media.id` | String containing a native movie/episode ID |
| Provider IDs | `tmdbid`/`tvdbid` numbers, `imdbid` string; never use as native IDs |
| Movie/series/episode `runtime` | Minutes, nullable |
| File/session `duration`, track `time`, player `position`, marker times | Seconds, possibly fractional |
| Track `progress` | Fraction 0–1, not percent; >= 0.9 is watched |
| File `size`, cache bytes | Bytes; a BIGINT field can be a decimal string depending on database driver |
| Bitrates, `maxBitrate`, trickplay `bandwidth` | Bits per second |
| `createdAt`, `updatedAt`, tracking/statistics timestamps | ISO date-time strings; nullable where stated |
| Release/air/birth/death dates | `YYYY-MM-DD` strings, nullable |
| Device `connectedAt`, live state `updatedAt`, invitation `expires` | Unix epoch milliseconds |
| Jellyfin playback positions | Ticks (10,000,000 per second); only on the separate compatibility API |

## Movies

Movie fields: `id`; nullable `tmdbid`, `imdbid`, `movieName`, `originalName`, `tagline`, `genres`, `originalLanguage`, `budget`, `revenue`, `runtime`, `popularity`, `siteRatingSource`, `siteRating`, `siteRatingCount`, `releaseDate`, `overview`; `createdAt`, `updatedAt`; nullable cached `trailers`, `certifications`, `trailersUpdatedAt`, `certificationsUpdatedAt`.

`genres` is normally a **string**, often JSON-encoded (for example `"[\"Drama\",\"Mystery\"]"`), with legacy comma-separated values possible. Normalize it for display. It is not the browse envelope's `facets.genres` array.

Detail adds `Files: File[]`, `TrackMovies: TrackMovie[]`, `credits: Credits`, and `userState: { favourite: boolean, watchlist: boolean }`. Plain/browse lists include caller tracks but not files or `userState`. Search includes files but not caller tracks. Related titles include caller tracks and `relationship`.

Illustrative detail excerpt (additional metadata omitted):

```json
{
  "id": 42,
  "movieName": "Example Movie",
  "releaseDate": "2024-06-01",
  "runtime": 120,
  "genres": "[\"Drama\"]",
  "siteRatingSource": "tmdb",
  "siteRating": 7.4,
  "siteRatingCount": 120,
  "TrackMovies": [{ "time": 600, "progress": 0.0833333, "updatedAt": "2026-10-14T10:00:00.000Z" }],
  "Files": [{ "id": 73, "name": "Example.mkv", "duration": 7200, "Streams": [] }],
  "credits": { "cast": [], "crew": [] },
  "userState": { "favourite": false, "watchlist": true },
  "trailers": null,
  "certifications": null
}
```

An empty `Files` array means no linked playable version. A file entry is a source choice, not a stream URL; use `Files[i].id` in session creation. The first file is not a documented quality/default preference.

## Series and episodes

Series fields: `id`; nullable `tvdbid`, `tmdbid`, `imdbid`, `zap2itId`, `seriesName`, `alias`, `genre`, `status`, `firstAired`, `network`, `runtime`, `overview`, `airsDayOfWeek`, `airsTime`, `rating`, `popularity`, `directory`, `siteRatingSource`, `siteRating`, `siteRatingCount`; `createdAt`, `updatedAt`; nullable extras/timestamps like movies and `catalogUpdatedAt`.

`genre` (singular) is stored as text and returned as text on lists. `/series/:id/info` normalizes a nonempty `genre` to a string array. Handle string, array and null. `rating` is a content-rating label; `siteRating` is an audience score. Detail adds `credits` and `userState: { favourite, watchlist }`. It does not include episodes, files or a series tracking record. The provider episode catalogue is omitted from ordinary responses; `/series/:id/library` is the separate management contract.

Episode fields: `id`, `SeriesId`, `airedSeason`, `airedEpisodeNumber`; nullable `tvdbid`, `tmdbid`, `imdbid`, `episodeName`, `absoluteNumber`, `dvdEpisodeNumber`, `dvdSeason`, `firstAired`, `overview`, `runtime`, `siteRatingSource`, `siteRating`, `siteRatingCount`; `createdAt`, `updatedAt`.

`airedSeason`, `airedEpisodeNumber`, `dvdSeason` and `dvdEpisodeNumber` are strings. Numerically sort valid aired values (then ID); preserve invalid/missing values as unknown. Do not sort `"10"` before `"2"`. Season `"0"` represents specials. Series IDs and episode IDs cannot substitute for file IDs.

| Episode endpoint | Associations/additions |
| --- | --- |
| `/episode/:id/info` | `Series`, full `Files[].Streams`, caller `TrackEpisodes`, `credits`, `userState: { favourite }` |
| `/series/:id/episodes` | Compact `Series: { id, seriesName }`, `Files: [{ id, duration }]`, caller `TrackEpisodes` |
| `/episodes/list/:sorting`, `/episodes/watching`, `/episodes/next` | `Series`, caller `TrackEpisodes`; no file list |
| `/episodes/search/:name` | `Series`, `Files` without streams, caller `TrackEpisodes` |
| `/episode/:id/files` | File array without streams |
| `/episode/:id/next` | Bare episode or empty body |
| `/episode/:id/context` entries | Episode fields, compact files and caller tracks; no parent `Series` |

Context returns `{ previous, next, nearby, nextUnwatched, season }`. Adjacent entries and `nextUnwatched` can be null. `nearby` is an array of at most five episodes in the same season. `season` contains `number` (stored season string), `position` (one-based index), `episodeCount`, `watchedCount`, `runtimeMinutes`, and nullable `averageRating`. Counts cover imported episodes, including metadata-only rows; `nextUnwatched` requires a linked file and progress below 0.9. The numerically adjacent `next` may be unavailable for playback.

## Watch progress and saved state

`TrackMovies`/`TrackEpisodes` are arrays, normally empty or containing one caller-specific row:

```ts
type Track = {
  id?: number;
  userId?: number;
  movieId?: number;   // movie tracking only
  episodeId?: number; // episode tracking only
  time: number | null;
  progress: number | null;
  createdAt?: string;
  updatedAt: string;
};
```

Missing tracking means no saved progress. Resume only when `time > 0` and `0 < progress < 0.9`; offer restart for watched items. Manual watched writes `time: 0, progress: 1`; unwatched writes both zero. Progress is last saved position divided by duration, so seeking can change watched state. Statistics completion instead requires distinct viewed coverage; these are separate concepts.

`userState` belongs to the caller. Favourites, watchlist membership and watched state are independent. Series have favourite/watchlist flags; episodes only have favourite. List/search responses do not universally include flags. A missing flag must not overwrite a previously loaded detail value. Partition caches by user and server.

## Files and streams

Full `File` fields: `id`; nullable `host`, `path`, `name`, `directory`, `extension`, `container`, `videoCodec`, `audioCodec`, `duration`, `hash`, `size`; `problematic`, `problemIgnored`, nullable `problemStage` (`identify` or `probe`), `error`; nullable `chapters`, `segments`, `trickplay`; `createdAt`, `updatedAt`; optionally `Streams` and join records such as `MovieFiles`/`EpisodeFiles`.

`host` empty/null or `local` means local storage; other values identify a federation source. `path` and `directory` refer to server storage and may appear in native metadata; they are not URLs or desktop paths. Federated `path` may be a peer file identifier. Always ask the receiving Oblecto server for playback.

`Streams` contains persisted FFprobe data with **flat** names. Use `index` as the absolute source stream index; `id` is a database row ID and the array offset is not a stream index.

| Fields | Meaning/type |
| --- | --- |
| `id`, `FileId`, `index` | Database IDs and nullable source index |
| `codec_type`, `codec_name`, `profile` | Nullable strings such as `audio`, `aac`, `LC` |
| `width`, `height`, `coded_width`, `coded_height`, `level`, `channels` | Nullable numbers |
| `sample_rate`, `bit_rate`, `max_bit_rate`, `duration` | Nullable numeric metadata; allow numeric strings from older storage/probes |
| `channel_layout`, `pix_fmt`, `sample_fmt` | Nullable strings |
| `avg_frame_rate`, `r_frame_rate`, `time_base`, aspect ratios | Nullable strings, often rational values such as `24000/1001` |
| `color_transfer`, `color_primaries`, `color_space`, `color_range` | Nullable strings; useful for HDR/source labels |
| `tags_language`, `tags_title` | Nullable language/title strings |
| `disposition_default`, `disposition_forced`, `disposition_hearing_impaired`, `disposition_attached_pic` | Nullable numeric flags, usually 0/1 |

Additional FFprobe columns may be present; the full stored vocabulary is in [stream.ts](../src/models/stream.ts). Do not require a codec-specific field on another kind of stream.

The playback descriptor's `tracks` has a different shape: live probe audio/subtitle tracks with `index`, `codec_type`, optional `codec_name`, `profile`, `channels`, `tags: { language?, title? }` and `disposition: { default?, forced?, attached_pic? }`. Do not read `tags_language` from a session track or `tags.language` from a persisted `Streams` row without adapting it. Session tracks are authoritative for the current negotiation.

## Credits and people

Media detail `credits` is `{ cast: Credit[], crew: Credit[] }`:

```ts
type Credit = {
  id: number; // credit row, not the person's ID
  person: { id: number; name: string; knownForDepartment: string | null };
  creditType: "cast" | "crew";
  order: number | null;
  character: string | null;
  job: string | null;
  department: string | null;
  episodeCount: number | null;
  roles: Array<{
    character: string | null;
    job: string | null;
    department: string | null;
    episodeCount?: number | null;
  }>;
  libraryConnections: { movies: number; series: number };
};
```

Credits group one person per cast/crew kind; summary role labels join distinct roles with ` / `. Use `person.id` for links. `libraryConnections` counts other top-level titles and excludes the current movie/series (or the episode's parent series). A cast/crew member can have multiple roles.

Person fields: `id`, `tmdbid`, `name`, nullable `biography`, `birthday`, `deathday`, `placeOfBirth`, `knownForDepartment`, `profilePath`, `metadataUpdatedAt`, plus `createdAt`/`updatedAt`. Fetch the image through `/person/:id/profile`; `profilePath` is provider metadata. Person info may enrich metadata on demand.

Person detail adds `credits: { movies, series, episodes }`. Each array entry is `{ item, roles }`, where `item` is the corresponding native media model and roles contain `type`, `character`, `job`, `department`, and optional `episodeCount`. Movie/episode items include caller tracking; episode items include `Series`. This is local-library filmography, not the person's entire external catalogue.

Related responses contain `{ items }`, with up to 12 local titles. Each `relationship` has `sharedCollections: [{ id, name }]`, `sharedPeople: [{ id, name }]`, and `sharedGenres: string[]`; use these for presentation instead of reproducing ranking. See [related titles](API.md#media-detail-metadata-and-related-titles).

## Extras and collections

Extras response: `{ trailers: Trailer[], certifications: Certification[], unavailable: boolean }`.

```ts
type Trailer = {
  name: string;
  site: "YouTube" | "Vimeo";
  key: string;
  language: string | null;
  official: boolean;
};
type Certification = { country: string; certification: string };
```

These are external trailer identifiers, not playable Oblecto media. Construct a provider URL from the known `site`/`key`; open it through the desktop's external-link handler. `unavailable: true` means refreshing at least one provider field failed; retained cached values may still be useful. Detail fields can be null before loading extras; a successful empty array means no results.

Movie/series set fields: `id`, nullable `setName`, `overview`, `tmdbid`, boolean `public`, `createdAt`, `updatedAt`. Creation accepts `name` but the response field is **`setName`**. Expanded movie sets use `Movies`; series sets use `Series` (an **array** here). In an episode, `Series` is instead one parent object. Ignore ORM join attributes. `/movies/set/:id` and `/series/set/:id` wrap the set in an array, even for one ID. Hidden/nonexistent sets return `[]`.

## Accounts and permissions

`User` has `id`, `username`, nullable `name`, `email`, `avatar`, `groupId`, and boolean `publicProfile`, `passwordlessLocal`. It never includes a password hash. `/api/v1/me` adds `hasPassword`, nullable `group: { id, name }`, `permissions: string[]`, and a fully defaulted `preferences` object. See [account preferences](API.md#account-v1) for every field and allowed value.

`Group` has `id`, `name`, `permissions: string[]`, `builtIn: boolean`, `members: number`. Permission catalogue entries are `{ key, description }`. Gate controls using permission strings, not group names or IDs. Ordinary users read their own effective permissions from `/api/v1/me`; the permission catalogue itself requires `users.manage`.

## Playback descriptors and markers

The [streaming contract](API.md#streaming) defines create/update/progress fields and a descriptor example. `state` currently uses `ready`, `playing`, `paused` and internally `ended`; it is server session state, not proof that the decoder is advancing. `paused` reflects the last progress report. There is no preparation polling state: creation awaits planning, while actual segments can still take time to encode.

`qualities` contains `{ id: string, height: number, bitrate: number }`. IDs can be `source`, `low` or height strings. These are rendition identifiers; they are not all valid values for a PATCH `quality`. Send `original`, `auto`, or numeric 360/480/720/1080. `method` is `direct`, `remux` or `transcode`; the latter two deliver HLS.

Markers:

```ts
type Chapter = { start: number; end: number; title: string | null };
type Segment = {
  type: "intro" | "credits" | "recap" | "preview";
  start: number;
  end: number;
  source: "chapters" | "fingerprint" | "manual";
};
type FileTrickplay = {
  width: number; height: number; // one thumbnail, in pixels
  tileWidth: number; tileHeight: number; // grid dimensions in thumbnails
  interval: number; count: number;
  sheets: number; bandwidth: number;
};
```

File marker records are `{ id, duration, chapters, segments, trickplay }`; null means analysis pending, empty arrays mean none found. In session descriptors, segments omit `source`, missing chapters/segments become `[]`, and `trickplay` is null or metadata whose `sheets` is an **array of authorized URLs** instead of a number. Session trickplay omits `bandwidth`. Use session sheet URLs, never storage paths. Thumbnail index is `min(count - 1, floor(position / interval))`; sheet index divides by `tileWidth * tileHeight`, with row-major coordinates within the sheet.

## Administration and statistics models

The [REST reference](API.md#settings--system-v1) defines configuration, maintenance jobs and status. Settings are section objects matching [res/config.json](../res/config.json) and [IConfig](../src/interfaces/config.ts); settings writes accept only the sections listed in the REST reference. Read existing values and PATCH only changed fields. Configuration responses contain sensitive administration data and are not a public server-discovery contract.

The [statistics reference](API.md#statistics) defines summary totals, daily/title/viewer breakdowns, session history, health buckets, collection degradation and retention. History is cursor-paged and includes historical title snapshots, so a missing current item must not discard a history row. Its ISO dates and UTC reporting periods are distinct from realtime epoch-millisecond timestamps.

Wire-shape sources: [models](../src/models), [REST routes](../src/submodules/REST/routes), [playback types](../src/lib/playback/types.ts), [realtime types](../src/lib/realtime/types.ts).
