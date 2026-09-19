# Jellyfin compatibility

Oblecto answers the Jellyfin API on port 8096 (`jellyfin.port`), so Jellyfin apps can sign in, browse and play. This page lists what each part of that API does.

## Signing in and access

- Every endpoint needs a signed-in session except discovery (`/System/Info/Public`, `/System/Ping`), sign-in (`/Users/AuthenticateByName`, `/Users/Public`), branding, localisation, the web client and item images.
- A session only ever sees its own user: user ids in paths, `UserId` parameters and bodies are replaced with the signed-in user's.
- Access tokens survive restarts and stop working when the user's password changes or the account is deleted. Signing out revokes the token until the next restart; changing the password revokes all of them.
- Failed sign-ins are throttled, as on the web app.
- Oblecto reports Jellyfin API version 10.11.5 and a server id derived from its signing secret.

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
| `GET /system/info/public` | ✅ Implemented | This server's id, name, version and the address the client used |
| `GET /system/info` | ✅ Implemented | As above, with operating system and architecture |
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
| `GET /users` | ✅ Implemented | Signed-in users only |
| `POST /users/authenticatebyname` | ✅ Implemented | Password, or password-less on the local network where allowed; 401 on failure, 429 when throttled |
| `GET /users/:userid`, `/users/me` | ✅ Implemented | Always the signed-in user |
| `GET /users/:userid/views` | ✅ Implemented | Same views as `/userviews` |
| `GET /users/:userid/policy` | ✅ Implemented | Administrator when the user's group may change settings |
| `POST /users/:userid/password` | ✅ Implemented | Changing your own password; resetting one is 501 |
| `POST /sessions/logout` | ✅ Implemented | Revokes the token |
| `POST /users/new`, `DELETE /users/:id` | ❌ Not Implemented | Manage users in the web app |
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
| `GET /users/:userid/items/latest` | ✅ Implemented | Recently added, for any library view |
| `GET /users/:userid/items/resume` | ✅ Implemented | Started, unfinished movies and episodes |
| `POST`/`DELETE /userplayeditems/:itemid` | ✅ Implemented | Marks a movie, episode or whole series watched or unwatched |
| `GET /useritems/:itemid/userdata` | ✅ Implemented | The user's progress |
| `POST /userfavoriteitems/:itemid`, `/useritems/:itemid/rating` | ❌ Not Implemented | 501: Oblecto has no favourites or ratings yet |
| `POST /items/:itemid/refresh` | ✅ Implemented | Queues a metadata update; needs the libraries permission |
| `POST /library/refresh` | ✅ Implemented | Starts a library scan; needs the libraries permission |
| `GET /shows/nextup` | ✅ Implemented | Logic for tracking progress |
| `GET /shows/:seriesid/seasons` | ✅ Implemented | |
| `GET /shows/:seriesid/episodes` | ✅ Implemented | |
| `GET /items/:mediaid/images/:type` | ✅ Implemented | Serves real artwork |
| `GET /search/hints` | ✅ Implemented | Search logic implemented |
| `GET /userviews` | ✅ Implemented | Movies, Shows and Collections |

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
- **DisplayPreferences**: `/displaypreferences/usersettings` (defaults only)
- **Activity log**: empty; Oblecto keeps none
- **Music**: not supported; audio streams answer 404
- **Devices**: `/devices` (Empty)
- **ScheduledTasks**: Most return 404 or empty.
- **Environment**: Directory browsers return empty.
- **SyncPlay**: All endpoints stubbed with 204/404.
- **Trailers**: Empty lists.
- **Collections**: Empty lists.
- **Playlists**: Empty lists.

## Missing Critical Features
- **User Management**: Creating and deleting users (501); use the web app or the command line.
- **Favourites and ratings**: 501 until Oblecto supports them.
- **Library Management**: Adding/Removing paths (partially stubbed, no logic).
- **Transcoding Options**: Hardcoded profiles.
- **Remote Access**: Not implemented.
- **Dashboard**: No implementation for admin dashboard data.
