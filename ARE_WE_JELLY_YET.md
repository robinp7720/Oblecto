# Are We Jelly Yet?

This document details the current state of the Jellyfin API emulation layer in Oblecto.
It compares the implementation against the Jellyfin API specification.

**Status Legend:**
- ✅ **Implemented**: Contains logic (database access, processing) and likely works.
- ⚠️ **Mocked**: Returns hardcoded static data to satisfy clients.
- 🚧 **Stubbed**: Returns empty lists, default objects, or success codes (204) to prevent client errors, but has no logic.
- ❌ **Not Implemented**: Explicit 501 Not Implemented or completely missing.

## Summary

The core playback and browsing functionality is largely **Implemented**. Clients can log in, browse libraries (Movies, Shows, Episodes), and stream media (Direct & Transcoded).
Peripheral features like LiveTV, Music, Channels, and Plugin management are mostly **Stubbed** or **Mocked** to ensure the UI loads without errors.

---

## Detailed Breakdown

### System & Configuration
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /system/info/public` | ⚠️ Mocked | Returns static server info |
| `GET /system/info` | ⚠️ Mocked | Returns static server info |
| `GET /system/info/storage` | ⚠️ Mocked | Returns static storage paths |
| `GET /system/endpoint` | ⚠️ Mocked | Returns generic endpoint info |
| `GET /system/configuration` | ⚠️ Mocked | Returns default config |
| `GET /system/configuration/metadata` | ⚠️ Mocked | |
| `GET /system/configuration/xbmcmetadata` | ⚠️ Mocked | |
| `GET /system/configuration/encoding` | ⚠️ Mocked | |
| `GET /branding/configuration` | ⚠️ Mocked | Returns "Oblecto Media server" |
| `GET /localization/options` | ⚠️ Mocked | English only |
| `GET /localization/cultures` | ⚠️ Mocked | en-US only |
| `GET /localization/countries` | ⚠️ Mocked | US only |
| `GET /web/configurationpages` | ⚠️ Mocked | |
| `GET /config.json` | ⚠️ Mocked | |

### Users & Auth
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /users` | ✅ Implemented | Fetches users from DB |
| `POST /users/authenticatebyname` | ✅ Implemented | Full login logic |
| `GET /users/:userid` | ✅ Implemented | |
| `GET /users/:userid/views` | ✅ Implemented | Returns hardcoded views (Movies, TV Shows) |
| `GET /users/:userid/policy` | 🚧 Stubbed | Returns empty object |
| `GET /auth/providers` | 🚧 Stubbed | Returns empty list |
| `GET /auth/passwordresetproviders` | 🚧 Stubbed | Returns empty list |
| `GET /quickconnect/enabled` | ⚠️ Mocked | Returns false |
| `POST /quickconnect/enabled` | ⚠️ Mocked | Returns false |
| `GET /quickconnect/*` | ❌ Not Implemented | 501s |

### Items & Library (Browsing)
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /items` | ✅ Implemented | Supports searching, sorting, filtering by type (Movie, Series, Episode) |
| `GET /items/:mediaid` | ✅ Implemented | Resolves Movie, Series, Episode, Season |
| `GET /users/:userid/items` | ✅ Implemented | Main browsing endpoint |
| `GET /users/:userid/items/latest` | ✅ Implemented | Recent movies/shows |
| `GET /shows/nextup` | ✅ Implemented | Logic for tracking progress |
| `GET /shows/:seriesid/seasons` | ✅ Implemented | |
| `GET /shows/:seriesid/episodes` | ✅ Implemented | |
| `GET /items/:mediaid/images/:type` | ✅ Implemented | Serves real artwork |
| `GET /search/hints` | ✅ Implemented | Search logic implemented |
| `GET /userviews` | ⚠️ Mocked | Returns hardcoded Collections/Movies/Shows views |

### Media Playback & Streaming
| Endpoint | Status | Notes |
|----------|--------|-------|
| `POST /items/:mediaid/playbackinfo` | ✅ Implemented | Resolves file/stream info |
| `GET /videos/:itemid/stream` | ✅ Implemented | Direct/Transcode stream logic |
| `GET /videos/:itemid/master.m3u8` | ✅ Implemented | HLS logic |
| `GET /hls/:sessionid/segment/:id` | ✅ Implemented | HLS segment serving |
| `POST /sessions/playing` | ✅ Implemented | Updates session state |
| `POST /sessions/playing/progress` | ✅ Implemented | Updates watch history/progress |
| `POST /sessions/playing/stopped` | ✅ Implemented | Cleans up session |
| `POST /sessions/capabilities/full` | 🚧 Stubbed | 204 |

### Live TV & Channels
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /channels` | 🚧 Stubbed | Returns empty list |
| `GET /livetv/*` | 🚧 Stubbed | Most return empty lists/objects or 404 |
| `GET /livetv/programs` | 🚧 Stubbed | Empty list |

### Music & Artists
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /artists` | 🚧 Stubbed | Empty list |
| `GET /musicgenres` | 🚧 Stubbed | Empty list |
| `GET /albums/*` | 🚧 Stubbed | Empty list |
| `GET /songs/*` | 🚧 Stubbed | Empty list |

### Plugins & Packages
| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /plugins` | 🚧 Stubbed | Empty list |
| `GET /packages` | 🚧 Stubbed | Empty list |
| `GET /repositories` | 🚧 Stubbed | Empty list |

### Other Stubbed Areas
- **DisplayPreferences**: `/displaypreferences/usersettings` (Mocked)
- **Devices**: `/devices` (Empty)
- **ScheduledTasks**: Most return 404 or empty.
- **Environment**: Directory browsers return empty.
- **SyncPlay**: All endpoints stubbed with 204/404.
- **Trailers**: Empty lists.
- **Collections**: Empty lists.
- **Playlists**: Empty lists.

## Missing Critical Features
- **User Management**: Creating/Deleting users (501).
- **Library Management**: Adding/Removing paths (partially stubbed, no logic).
- **Transcoding Options**: Hardcoded profiles.
- **Remote Access**: Not implemented.
- **Dashboard**: No implementation for admin dashboard data.
