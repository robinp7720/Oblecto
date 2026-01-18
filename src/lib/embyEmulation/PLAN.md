# Jellyfin Emulation Coverage Plan

Scope
- This document compares the current Jellyfin/Emby emulation layer to the Jellyfin API specification and records what is implemented, partially implemented, and missing.
- Source of truth for spec comparison: `jellyfin-openapi-stable.json` in the repo, which mirrors the official Jellyfin OpenAPI stable spec. See the official spec location for reference. (https://api.jellyfin.org/openapi/jellyfin-openapi-stable.json)

How to read
- Implemented: Endpoints return real data or perform real actions in Oblecto (DB reads/writes, streaming, image serving).
- Partially implemented: Endpoints exist but return static placeholders, empty lists, hardcoded data, or ignore important params.
- Missing: Endpoints present in the Jellyfin spec but not implemented in the emulation routes (after path param normalization).

Summary (normalized path params)
- Spec endpoints: 388
- Emulation endpoints: 333
- Missing endpoints (spec - emulation): 110
- Extra endpoints (emulation - spec): 55

Implemented
- Items
  - GET /items
  - GET /items/{param}
  - GET /items/{param}/images/primary
  - GET /items/{param}/images/backdrop/{param}
  - GET /items/{param}/images/{param}
  - GET /items/{param}/images/{param}/{param}
  - POST /items/{param}/playbackinfo
- Shows
  - GET /shows/nextup
  - GET /shows/{param}/seasons
  - GET /shows/{param}/episodes
- Users
  - GET /users
  - POST /users/authenticatebyname
  - GET /users/{param}/items
  - GET /users/{param}/items/{param}
- Sessions
  - POST /sessions/playing/progress (writes playback progress to TrackEpisode/TrackMovie)
- Video/Audio streaming
  - GET /hls/{param}/segment/{param}
  - GET /videos/{param}/stream
  - GET /videos/{param}/stream.{param}
  - HEAD /videos/{param}/stream
  - HEAD /videos/{param}/stream.{param}
  - GET /audio/{param}/stream
  - GET /audio/{param}/stream.{param}
  - HEAD /audio/{param}/stream
  - HEAD /audio/{param}/stream.{param}
  - GET /videos/{param}/main.m3u8
  - GET /videos/{param}/master.m3u8
  - GET /videos/{param}/live.m3u8
  - GET /videos/{param}/hls/{param}/stream.m3u8
  - GET /videos/{param}/hls/{param}/{param}.{param}
  - GET /videos/{param}/hls1/{param}/{param}.{param}
  - GET /videos/{param}/stream/{param}
  - GET /audio/{param}/main.m3u8
  - GET /audio/{param}/master.m3u8
  - GET /audio/{param}/hls1/{param}/{param}.{param}
- System/utility
  - GET /system/ping
  - POST /system/ping
  - GET /getutctime

Partially implemented
- System
  - GET /system/info, /system/info/public, /system/info/storage (static/hardcoded)
  - GET /system/endpoint (static)
  - GET /system/configuration, /system/configuration/metadata, /system/configuration/xbmcmetadata, /system/configuration/encoding (static)
  - GET /System/ActivityLog/Entries (static)
  - GET /scheduledtasks (empty object)
- Users
  - GET /users/public (empty)
  - GET /users/{param} (returns user id 1 regardless of param)
  - GET /users/{param}/views (static)
  - GET /users/{param}/items/latest (returns series/movies with mostly static fields)
  - GET /users/{param}/items/{param}/intros (empty)
  - GET /users/{param}/items/resume, /useritems/resume (empty)
  - POST /userplayeditems/{param}, DELETE /userplayeditems/{param} (no-op 200)
  - POST /userfavoriteitems/{param}, DELETE /userfavoriteitems/{param} (no-op 200)
  - GET /useritems/{param}/userdata, POST /useritems/{param}/rating (empty)
- Items
  - GET /items/{param}/similar, /items/{param}/thememedia (empty)
  - GET /userviews (static)
  - GET /items/filters, /items/filters2 (empty)
  - GET /items/{param}/images (empty list)
  - GET /items/{param}/externalidinfos (empty)
  - POST /items/remotesearch/* (empty arrays)
  - POST /items/{param}/refresh (204)
  - GET /items/{param}/contenttype (empty)
  - GET /items/{param}/metadataeditor (empty)
  - GET /items/{param}/ancestors (empty)
  - GET /items/{param}/criticreviews (empty)
  - GET /items/{param}/download, /items/{param}/file (404)
  - GET /items/{param}/themesongs, /items/{param}/themevideos (empty)
  - GET /items/counts (empty)
  - GET /items/{param}/remoteimages, /items/{param}/remoteimages/providers (empty)
  - GET /items/{param}/remotesearch/subtitles/{param} (empty) and /items/{param}/remotesearch/subtitles/{param} (404)
  - GET /items/suggestions, /items/{param}/intros, /items/{param}/localtrailers, /items/{param}/specialfeatures, /items/root (empty)
  - GET /movies/{param}/similar, /movies/recommendations, /shows/{param}/similar, /shows/upcoming, /trailers, /trailers/{param}/similar, /search/hints (empty)
- Sessions
  - POST /sessions/capabilities/{param}, /sessions/playing, /sessions/playing/ping, /sessions/playing/stopped (no-op or minimal)
  - GET /sessions, /sessions/viewing (empty)
  - POST /sessions/:id/command*, /sessions/logout, /sessions/:id/viewing (no-op)
  - SyncPlay endpoints are stubs (mostly 204 or empty; /syncplay/{id} returns 404)
  - GET /playback/bitratetest (static "0")
  - DELETE /playingitems/{param}, POST /playingitems/{param}/progress (204)
- Videos (metadata helpers)
  - GET /videos/activeencodings (empty)
  - GET /videos/mergeversions (204)
  - GET /videos/{param}/additionalparts, /videos/{param}/alternatesources (empty)
  - GET /videos/{param}/subtitles (empty)
  - GET /videos/{param}/subtitles/{param}, /videos/{param}/trickplay/*, /videos/{param}/{param}/subtitles/*, /videos/{param}/{param}/attachments/{param} (404)
  - GET /mediasegments/{param} (empty)
- Devices
  - GET /devices, /devices/info, /devices/options (empty)
- DisplayPreferences
  - GET /displaypreferences/usersettings (static)
  - GET /LiveTv/Programs/Recommended (empty)
  - POST /displaypreferences/{param} (204)
- Branding/Web
  - GET /branding/configuration (static)
  - GET /branding/css, /branding/css.css, /branding/splashscreen (empty)
  - GET /web/configurationpages, /config.json (static)
  - GET /web/configurationpage (404)
- Localization
  - GET /localization/options, /localization/cultures, /localization/countries (static)
  - GET /localization/parentalratings (empty)
- Library/Collections/Genres/Years/Playlists
  - Most endpoints return empty lists or 404; virtual folder updates return 204
- Channels/LiveTV
  - All endpoints stubbed (empty/404/204)
- Music/Artists/Persons/Studios
  - All endpoints stubbed (empty/404)
- Plugins/Packages/Repositories
  - List endpoints return empty; enable/disable/install return 204; others 404
- Other/Environment/Startup
  - Environment endpoints return empty or 204
  - Startup endpoints return empty or 204
  - FallbackFont endpoints return empty or 404
  - GET /tmdb/clientconfiguration returns empty

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
DELETE /useritems/{param}/rating
DELETE /users/{param}
DELETE /videos/activeencodings
DELETE /videos/{param}/alternatesources
DELETE /videos/{param}/subtitles/{param}
GET /displaypreferences/{param}
GET /items/{param}/images/{param}/{param}/{param}/{param}/{param}/{param}/{param}/{param}
GET /items/{param}/playbackinfo
GET /providers/lyrics/{param}
GET /providers/subtitles/subtitles/{param}
HEAD /artists/{param}/images/{param}/{param}
HEAD /audio/{param}/master.m3u8
HEAD /audio/{param}/stream
HEAD /audio/{param}/stream.{param}
HEAD /audio/{param}/universal
HEAD /genres/{param}/images/{param}
HEAD /genres/{param}/images/{param}/{param}
HEAD /items/{param}/images/{param}
HEAD /items/{param}/images/{param}/{param}
HEAD /items/{param}/images/{param}/{param}/{param}/{param}/{param}/{param}/{param}/{param}
HEAD /musicgenres/{param}/images/{param}
HEAD /musicgenres/{param}/images/{param}/{param}
HEAD /persons/{param}/images/{param}
HEAD /persons/{param}/images/{param}/{param}
HEAD /studios/{param}/images/{param}
HEAD /studios/{param}/images/{param}/{param}
HEAD /userimage
HEAD /videos/{param}/master.m3u8
HEAD /videos/{param}/stream
HEAD /videos/{param}/stream.{param}
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
POST /playingitems/{param}
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
POST /system/configuration
POST /system/configuration/branding
POST /system/configuration/{param}
POST /userimage
POST /useritems/{param}/userdata
POST /users
POST /users/configuration
POST /users/{param}/policy
POST /videos/mergeversions
POST /videos/{param}/subtitles

Extra endpoints (emulation - spec)

DELETE /sessions/{param}/playing
GET /
GET /audio/{param}/remotesearch/lyrics/{param}
GET /collections
GET /collections/{param}/items
GET /config.json
GET /displaypreferences/usersettings
GET /hls/{param}/segment/{param}
GET /items/{param}/contenttype
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
GET /livetv/tunerhosts
GET /packages/installed/{param}
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
GET /users/configuration
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
POST /quickconnect/enabled
POST /sessions/capabilities/{param}


Notes
- Path comparison normalizes parameter names, so /items/{itemId} and /items/:mediaid are considered the same shape.
- Extra endpoints include Emby-specific shapes and method mismatches compared to Jellyfin spec.
- When extending or modifying endpoints, update this file and the change log below.

Change log
- 2026-01-18: Added image-type handling for /items/{id}/images/* with size selection + episode thumb tags; added regression test for episode Thumb tags; created PLAN.md + AGENTS.md for Jellyfin emulation tracking.
