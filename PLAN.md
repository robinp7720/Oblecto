# Oblecto roadmap

Status of the feature tracks this file used to plan in detail, as of 2 October 2026 (after 1.0.1). Pick open work from "Next".

## Done

| Track | Where it lives |
|---|---|
| Library browsing: filters, sorting, cursor pagination, URL state | `src/submodules/REST/routes/helpers/browse.ts`, `Oblecto-Web/src/views/LibraryView.vue` |
| Playback analysis: chapters, seek thumbnails, intro/credit detection and skip controls | `src/lib/analysis/`, `Oblecto-Web/src/components/player/` |
| Player: volume, audio and subtitle tracks, speed, hotkeys, seek bar, up next | `Oblecto-Web/src/components/player/`, `Oblecto-Web/src/playback/` |
| Continue watching | `/movies/watching`, `/episodes/watching`, Jellyfin `/Items/Resume` |
| Accounts: profile, password, avatar, preferences; groups and permissions | `src/submodules/REST/routes/v1/account.ts`, `src/lib/auth/permissions.ts` |
| Problem files: why a file failed, retry, ignore | `src/lib/indexers/files/problems.ts`, `/files/problematic` |
| Cast, crew and person pages; related titles; episode context | `src/lib/updaters/common/CreditSync.ts`, `src/submodules/REST/routes/people.ts`, `routes/helpers/` |
| Live library and progress updates in the web app | `indexer` and `media:progress` events, `src/lib/realtime/` |
| Loading, empty and error states with retry | `Oblecto-Web/src/components/media/HomeLoadState.vue`, `Oblecto-Web/src/views/LibraryView.vue` |
| Web app state in Pinia (Vuex is gone) | `Oblecto-Web/src/stores/` |
| CI: lint, typecheck, tests, build, browser suites | `.github/workflows/ci.yml`, `npm run verify` |
| Jellyfin API: browsing, real metadata, collections, people, genres, favourites, settings, branding, sessions, played state, resume | `src/lib/embyEmulation/`, [docs/JELLYFIN.md](docs/JELLYFIN.md) |
| Federation: mutual pairing, catalog snapshots, administration | `src/lib/federation/`, [docs/FEDERATION.md](docs/FEDERATION.md) |

## Next

- **Favourites, watchlist and ratings in Oblecto's own API and web app.** Favourites are stored (`UserFavourites`, `src/lib/users/favourites.ts`) but only the Jellyfin API reads and writes them; the REST API and web app have no favourites yet. There is no watchlist or rating model; Jellyfin's rating endpoints answer 501.
- **Editing metadata by hand, and bulk actions.** Only artwork can be replaced today.
- **Subtitle files beside the video.** Indexing only picks up video extensions (`fileExtensions.video`), so `.srt`, `.ass` and `.vtt` sidecars are ignored and only embedded subtitles play. No subtitle search or download.
- **Keeping libraries current on their own.** There is no file watcher or scheduled scan; scans run on demand or at boot (`indexer.runAtBoot`).
- **Per-library access and parental controls.** Groups grant actions, not visibility of libraries or ratings.
- **Playlists and downloads.** Not implemented.
- **Music.** Undecided. The Jellyfin audio routes answer 404 and the artist routes return empty lists.
- **Tests.** `npm run typecheck` covers `src/` only: including `tests/` gives 173 type errors, almost all loose mock typings in `tests/mocha`. `/api/v1/libraries` and the set routes have no route-level specs; user, group and system routes are covered mainly for permission checks. `tests/network` had five TVDB assertions that no longer matched TVDB's answers at 1.0.
- **Web UI.** Only six of 74 components use i18n, and English is the only locale.
- **Jellyfin.** QuickConnect, device and session lists, remote control of Jellyfin apps, creating and deleting users, library folder management, and creating collections and playlists. See `src/lib/embyEmulation/PLAN.md` for the full list.
- **Small fixes found while documenting.** `POST /set/movie` and `POST /set/series` return the validation error instead of throwing it, so a request with a non-boolean `public` never gets an answer. `GET /movies/sets`, `/movies/set/:id`, `/series/sets` and `/series/set/:id` list every set, private ones included, while the Jellyfin API only shows public sets and the ones shared with the user.
