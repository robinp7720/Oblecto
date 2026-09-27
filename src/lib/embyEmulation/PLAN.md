# Jellyfin Emulation Coverage Plan

Scope
- This document compares the Jellyfin/Emby emulation layer with the Jellyfin API specification and records what is implemented, partially implemented, and missing.
- Source of truth for the comparison: `jellyfin-openapi-stable.json`, fetched by `scripts/fetch-jellyfin-openapi.sh` from https://api.jellyfin.org/openapi/jellyfin-openapi-stable.json. Last compared against spec version 12.1.0 on 2026-09-27.

How to read
- Implemented: endpoints return real data or perform real actions in Oblecto (database reads and writes, streaming, image serving, configuration).
- Partially implemented: endpoints exist but return static placeholders, empty lists or hardcoded data, or ignore important parameters.
- Missing: endpoints in the Jellyfin spec with no route in the emulation, after path parameter normalisation.

Summary (normalised path parameters; HEAD counts as covered where GET is, as Express answers it)
- Spec endpoints: 364
- Covered by a route: 281
- Missing (spec - emulation): 83
- Extra (emulation - spec): 78

Implemented
- Items and browsing (one engine, `ServerAPI/itemQuery.ts`)
  - GET /items, GET /users/{id}/items: IncludeItemTypes, ExcludeItemTypes, ParentId (library views, series, season, collection), Recursive, Ids, SearchTerm/NameStartsWith, SortBy/SortOrder (SortName, DateCreated, DateLastContentAdded, PremiereDate, ProductionYear, CommunityRating, Runtime, DatePlayed, ParentIndexNumber, IndexNumber, Random), Filters (IsPlayed, IsUnplayed, IsResumable, IsFavorite), IsPlayed, IsFavorite, Genres, GenreIds, PersonIds, Years, SeriesId, StartIndex/Limit
  - GET /items/{id}, GET /users/{id}/items/{id}: movies, series, seasons, episodes, collections, people and genres; People on detail pages
  - GET /items/{id}/images, /items/{id}/images/{type}[/{index}]: posters, fanart, episode stills, person profiles, collection artwork
  - GET /items/{id}/similar, /movies/{id}/similar, /shows/{id}/similar, /trailers/{id}/similar, GET /movies/recommendations
  - GET /items/{id}/ancestors, /items/{id}/collections, /items/counts, /items/filters, /items/filters2
  - GET /users/{id}/items/latest, /items/latest, /users/{id}/items/resume, /useritems/resume (MediaTypes and IncludeItemTypes honoured)
  - GET /search/hints
  - POST /items/{id}/refresh (queues a metadata update; libraries permission)
- Collections, people and genres
  - BoxSets are movie sets the user may see (public, or shared through MovieSetUsers)
  - GET /persons, /persons/{name}, /persons/{name}/images/{type}[/{index}]
  - GET /genres, /genres/{name}
- Shows
  - GET /shows/nextup, /shows/{id}/seasons, /shows/{id}/episodes
- Users and user data
  - GET /users, /users/public, /users/{id} (always the signed-in user), /users/{id}/policy, /users/{id}/views, /userviews, /users/{id}/images/primary
  - POST /users/authenticatebyname, /users/password, /users/{id}/password, /sessions/logout
  - POST /users/configuration, /users/{id}/configuration (audio and subtitle languages, subtitle mode, next-episode autoplay, saved as Oblecto preferences)
  - POST/DELETE /userplayeditems/{id}, /users/{id}/playeditems/{id} (movies, episodes, whole series or seasons)
  - POST/DELETE /userfavoriteitems/{id}, /users/{id}/favoriteitems/{id} (movies, series, seasons, episodes, people, collections)
  - GET /useritems/{id}/userdata
  - GET/POST /displaypreferences/{id} (per user and client)
- Sessions and playback
  - POST /sessions/playing, /sessions/playing/progress, /sessions/playing/stopped, /sessions/playing/ping, /sessions/capabilities/{type}
  - GET/POST /items/{id}/playbackinfo, and the video, audio and HLS stream routes
- WebSocket (/socket, ?api_key= or ?ApiKey=)
  - ForceKeepAlive on connect, KeepAlive answered, UserDataChanged pushed for watch state, progress and favourite changes made anywhere
- System, configuration and branding
  - GET /system/info, /system/info/public, /system/ping, /getutctime
  - GET/POST /system/configuration (ServerName from jellyfin.serverName; resume thresholds match Oblecto's)
  - GET/POST /system/configuration/encoding (hardware encoder from transcoding.*)
  - GET/POST /system/configuration/branding, GET /branding/configuration, /branding/css, /branding/css.css (jellyfin.loginDisclaimer, jellyfin.customCss)
  - Saving needs the settings.manage permission and uses the web UI's validation and config writer
  - POST /library/refresh (library scan; libraries permission)

Partially implemented
- System: /system/info/storage, /system/endpoint, /system/configuration/metadata and /xbmcmetadata, /system/activitylog/entries, /scheduledtasks (static or empty); other /system/configuration/{key} answer 404
- Localization: /localization/options, /cultures, /countries (English/US only); /localization/parentalratings (empty)
- Items: /items/{id}/thememedia, /themesongs, /themevideos, /intros, /localtrailers, /specialfeatures, /criticreviews, /externalidinfos, /remoteimages*, /remotesearch/*, /contenttype, /metadataeditor, /items/suggestions, /items/root (empty); /items/{id}/download and /file (404)
- Shows: /shows/upcoming, /trailers (empty)
- Sessions: /sessions, /sessions/viewing (empty); remote-control commands (204, not delivered); SyncPlay (204 or 404)
- Videos: /videos/{id}/subtitles*, trickplay, attachments, additional parts, alternate sources, active encodings, merge versions (empty, 404 or 204); /mediasegments/{id} (empty)
- Devices, plugins, packages, repositories, environment, startup, fallback fonts, QuickConnect: empty lists, 204 or 404
- Library management: virtual folders and paths (empty or 204); /collections and /playlists (empty)
- Live TV, channels, music, artists, studios, years: empty or 404
- Ratings: POST/DELETE /useritems/{id}/rating answer 501 (Oblecto has no ratings)
- Users: creating, deleting and resetting users answer 501 (managed in the web app)

Missing endpoints (spec - emulation)

DELETE /audio/{param}/lyrics
DELETE /branding/splashscreen
DELETE /collections/{param}/items
DELETE /devices
DELETE /items
DELETE /items/{param}
DELETE /items/{param}/images/{param}
DELETE /items/{param}/images/{param}/{param}
DELETE /library/virtualfolders
DELETE /library/virtualfolders/paths
DELETE /livetv/listingproviders
DELETE /livetv/recordings/{param}
DELETE /livetv/seriestimers/{param}
DELETE /livetv/timers/{param}
DELETE /livetv/tunerhosts
DELETE /packages/installing/{param}
DELETE /playlists/{param}/items
DELETE /playlists/{param}/users/{param}
DELETE /plugins/{param}
DELETE /plugins/{param}/{param}
DELETE /scheduledtasks/running/{param}
DELETE /sessions/{param}/user/{param}
DELETE /userimage
DELETE /users/{param}
DELETE /videos/{param}/alternatesources
DELETE /videos/{param}/subtitles/{param}
GET /items/{param}/images/{param}/{param}/{param}/{param}/{param}/{param}/{param}/{param}
GET /providers/lyrics/{param}
GET /providers/subtitles/subtitles/{param}
HEAD /items/{param}/images/{param}/{param}/{param}/{param}/{param}/{param}/{param}/{param}
POST /audio/{param}/lyrics
POST /audio/{param}/remotesearch/lyrics/{param}
POST /branding/splashscreen
POST /collections
POST /collections/{param}/items
POST /devices/options
POST /items/{param}
POST /items/{param}/contenttype
POST /items/{param}/images/{param}
POST /items/{param}/images/{param}/{param}
POST /items/{param}/images/{param}/{param}/index
POST /items/{param}/remoteimages/download
POST /items/{param}/remotesearch/subtitles/{param}
POST /library/media/updated
POST /library/movies/added
POST /library/movies/updated
POST /library/series/added
POST /library/series/updated
POST /library/virtualfolders
POST /library/virtualfolders/libraryoptions
POST /library/virtualfolders/name
POST /library/virtualfolders/paths
POST /livetv/channelmappings
POST /livetv/listingproviders
POST /livetv/programs
POST /livetv/seriestimers
POST /livetv/seriestimers/{param}
POST /livetv/timers
POST /livetv/timers/{param}
POST /livetv/tunerhosts
POST /packages/installed/{param}
POST /playlists
POST /playlists/{param}
POST /playlists/{param}/items
POST /playlists/{param}/users/{param}
POST /plugins/{param}/configuration
POST /plugins/{param}/manifest
POST /quickconnect/initiate
POST /scheduledtasks/{param}/triggers
POST /sessions/capabilities
POST /sessions/viewing
POST /sessions/{param}/playing
POST /startup/complete
POST /startup/configuration
POST /startup/remoteaccess
POST /startup/user
POST /system/configuration/{param}
POST /userimage
POST /useritems/{param}/userdata
POST /users
POST /users/{param}/policy
POST /videos/mergeversions
POST /videos/{param}/subtitles

Extra endpoints (emulation - spec)

DELETE /playingitems/{param}
DELETE /sessions/{param}/playing
DELETE /users/{param}/favoriteitems/{param}
DELETE /users/{param}/items/{param}/rating
DELETE /users/{param}/playeditems/{param}
GET /
GET /artists/instantmix
GET /audio/{param}/hls/{param}/stream.aac
GET /audio/{param}/hls/{param}/stream.mp3
GET /audio/{param}/hls1/{param}/{param}.{param}
GET /audio/{param}/main.m3u8
GET /audio/{param}/master.m3u8
GET /audio/{param}/remotesearch/lyrics/{param}
GET /collections
GET /collections/{param}/items
GET /config.json
GET /environment/networkshares
GET /items/{param}/contenttype
GET /items/{param}/criticreviews
GET /items/{param}/images/backdrop/{param}
GET /items/{param}/images/primary
GET /items/{param}/images/{param}/{param}/index
GET /items/{param}/remoteimages/download
GET /library/media/updated
GET /library/movies/added
GET /library/movies/updated
GET /library/series/added
GET /library/series/updated
GET /library/virtualfolders/libraryoptions
GET /library/virtualfolders/name
GET /library/virtualfolders/paths
GET /livetv/channelmappings
GET /livetv/listingproviders
GET /livetv/recordings/groups
GET /livetv/recordings/groups/{param}
GET /livetv/recordings/series
GET /livetv/tunerhosts
GET /musicgenres
GET /packages/installed/{param}
GET /playback/media/{param}/{param}/{param}
GET /playlists
GET /plugins/{param}/manifest
GET /plugins/{param}/{param}
GET /quickconnect/initiate
GET /scheduledtasks/{param}/triggers
GET /sessions/capabilities
GET /sessions/viewing
GET /startup/complete
GET /startup/remoteaccess
GET /system/configuration/branding
GET /system/configuration/encoding
GET /system/configuration/metadata
GET /system/configuration/xbmcmetadata
GET /tmdb/clientconfiguration
GET /users/{param}/images/primary
GET /users/{param}/items
GET /users/{param}/items/latest
GET /users/{param}/items/resume
GET /users/{param}/items/{param}
GET /users/{param}/items/{param}/intros
GET /users/{param}/policy
GET /users/{param}/views
GET /videos/activeencodings
GET /videos/mergeversions
GET /videos/{param}/alternatesources
GET /videos/{param}/stream/{param}
GET /videos/{param}/subtitles
GET /videos/{param}/subtitles/{param}
POST /packages/installing/{param}
POST /playingitems/{param}/progress
POST /quickconnect/enabled
POST /sessions/capabilities/{param}
POST /system/configuration/encoding
POST /users/{param}/configuration
POST /users/{param}/favoriteitems/{param}
POST /users/{param}/items/{param}/rating
POST /users/{param}/password
POST /users/{param}/playeditems/{param}

Notes
- Path comparison normalises parameter names, so /items/{itemId} and /items/:mediaid are the same shape.
- Extra endpoints include Emby-era shapes and methods the current spec no longer lists; clients still call some of them.
- The emulation reports Jellyfin API version 10.11.5 (`JELLYFIN_API_VERSION`); the bundled jellyfin-web 12.1 needs 10.10 or later.
- When extending or modifying endpoints, update this file and the change log below.

Change log
- 2026-01-18: Added image-type handling for /items/{id}/images/* with size selection + episode thumb tags; added regression test for episode Thumb tags; created PLAN.md + AGENTS.md for Jellyfin emulation tracking.
- 2026-01-18: Implemented search hints + multi-type search handling for /items; added tests for array query params in items/users search flows.

- 2026-09-17: Replaced playback negotiation/delivery with the shared viewer-owned playback engine. GET/POST PlaybackInfo returns probed track metadata, external text-subtitle URLs, and negotiated direct or HLS URLs; bitrate/profile changes preserve position and expired leases are replaced; progress/stop/ping share lifecycle and persistence. Removed item-global HLS reuse and obsolete stream implementation. Media URLs use scoped tokens; query values retain case; X-Emby-Authorization token parsing accepts MediaBrowser headers. Removed hard-coded websocket playback injection, validated websocket sessions, and added awaited shutdown. Federation playback uses protocol v1 on the owning server. Browser automation covers Chromium/Firefox/WebKit; actual Safari/iOS and Jellyfin Media Player device acceptance remains a release check.
- 2026-09-17: Fixed Jellyfin frontend delivery from bundled server and CLI entrypoints; the build now compiles and copies jellyfin-web into the packaged dist tree.
- 2026-09-27: Browsing, metadata and user data. One item query engine (ServerAPI/itemQuery.ts) behind /Items, /Users/{id}/Items and the /Shows lists: correct paging, the caller's watch state, sort orders, Filters/IsPlayed/IsFavorite/Ids/Genres/GenreIds/PersonIds/Years, library-view, series, season and collection parents. Item DTOs carry real genres, provider ids, tagline, studios, ratings and dates, folder counts and unplayed counts, and People on detail pages; the made-up ratings and blurhashes are gone. New: BoxSets from movie sets, /Persons, /Genres, Similar, Recommendations, Ancestors, Counts, Filters, Items/{id}/Collections and Items/{id}/Images. Favourites (UserFavourites, migration 0008), user configuration saved as Oblecto preferences, display preferences kept per user and app. System configuration, encoding and branding read from and saved to Oblecto's config (jellyfin.serverName, loginDisclaimer, customCss), admins only. Sockets accept ?ApiKey= (the Jellyfin SDK's), answer KeepAlive, send ForceKeepAlive and push UserDataChanged; /Sessions/Playing no longer echoes Play. Checked against jellyfin-web 12.1 in Chromium.
