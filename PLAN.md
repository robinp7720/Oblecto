# Oblecto roadmap

Status of the feature tracks this file used to plan in detail, as of 23 October 2026 (after 1.0.1). Pick open work from "Next".

## Done

| Track | Where it lives |
|---|---|
| Adaptive playback defaults/240p, audio-only conversion, delivery overlap, bounded sequential HLS (opt-in), persistent preparation and constrained-network benchmark | `src/lib/playback/`, migration 0017, [streaming](docs/STREAMING.md) |
| Browse indexes and facet aggregation/cache, shared playback preparation and complete startup diagnostics, deferred web routes/player | `src/submodules/REST/routes/helpers/facets.ts`, `src/lib/playback/`, migration 0015 |
| Viewing history, personal/admin statistics, library totals and playback-health charts | `src/lib/statistics/`, `Oblecto-Web/src/views/StatisticsView.vue`, [API](docs/API.md#statistics) |
| Library browsing: filters, sorting, cursor pagination, URL state | `src/submodules/REST/routes/helpers/browse.ts`, `Oblecto-Web/src/views/LibraryView.vue` |
| Focused TV detail pages: manager-only episode matching workspace, scoped season actions, library viewing progress, spoilers, chapters, crew and provider links | `src/lib/series/SeriesExtras.ts`, `Oblecto-Web/src/components/details/` |
| Movie/series favourites and private watchlists, episode favourites, and saved-list library filters | `src/lib/users/`, `src/submodules/REST/routes/movies.ts`, `Oblecto-Web/src/components/details/MovieSaveButtons.vue` |
| Movie trailers, regional certifications, full crew, provider links, progress/finish time and per-version track details | `src/lib/movies/MovieExtras.ts`, `Oblecto-Web/src/components/pages/MovieInfo.vue` |
| Focused movie banners with compact actions, a More menu and secondary information below the hero | `Oblecto-Web/src/components/details/MediaDetailHero.vue`, `Oblecto-Web/src/components/details/MovieActionsMenu.vue` |
| Playback analysis: chapters, seek thumbnails, intro/credit detection and skip controls | `src/lib/analysis/`, `Oblecto-Web/src/components/player/` |
| Player: volume, audio and subtitle tracks, speed, hotkeys, seek bar, next-episode cards and inactivity confirmation | `Oblecto-Web/src/components/player/`, `Oblecto-Web/src/playback/` |
| Continue watching | `/movies/watching`, `/episodes/watching`, Jellyfin `/Items/Resume` |
| Sets: private visibility on every native read, validated creation, creator access | `src/lib/sets/visibility.ts`, `src/submodules/REST/routes/sets.ts`, `tests/mocha/sets.spec.ts` |
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

- **Sequential playback rollout.** Window mode remains opt-in until repeatable startup/rebuffer and direct-play regression targets pass on representative media and clients; see [performance acceptance](docs/STREAMING.md#performance-acceptance).

- **Favourites for other media in the native app.** Movie, series and episode favourites and movie/series watchlists are available. Seasons, people and collections still need native favourite controls.
- **Editing metadata by hand, and bulk actions.** Only artwork can be replaced today.
- **Subtitle files beside the video.** Indexing only picks up video extensions (`fileExtensions.video`), so `.srt`, `.ass` and `.vtt` sidecars are ignored and only embedded subtitles play. No subtitle search or download.
- **Keeping libraries current on their own.** There is no file watcher or scheduled scan; scans run on demand or at boot (`indexer.runAtBoot`).
- **Per-library access and parental controls.** Groups grant actions, not visibility of libraries or ratings.
- **Playlists and downloads.** Not implemented.
- **Music.** Undecided. The Jellyfin audio routes answer 404 and the artist routes return empty lists.
- **Tests.** `npm run typecheck` covers `src/` only: including `tests/` gives 173 type errors, almost all loose mock typings in `tests/mocha`. `/api/v1/libraries` has no route-level specs; set privacy and validation have route-level coverage; user, group and system routes are covered mainly for permission checks. `tests/network` had five TVDB assertions that no longer matched TVDB's answers at 1.0.
- **Web UI.** Only six of 74 components use i18n, and English is the only locale.
- **Jellyfin.** QuickConnect, device and session lists, remote control of Jellyfin apps, creating and deleting users, library folder management, and creating collections and playlists. See `src/lib/embyEmulation/PLAN.md` for the full list.

## Change log

- 2026-10-23: Improved adaptive quality, audio-only conversion, encoding/delivery overlap and cache fairness; added opt-in sequential HLS windows, persistent playback preparation, diagnostics and constrained-network acceptance tooling.
