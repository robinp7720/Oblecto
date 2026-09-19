# Oblecto roadmap

Status of the feature tracks this file used to plan in detail, as of 1.0. Pick open work from "Next".

## Done

| Track | Where it lives |
|---|---|
| Library browsing: filters, sorting, cursor pagination, URL state | `src/submodules/REST/routes/helpers/browse.ts`, `Oblecto-Web/src/views/LibraryView.vue` |
| Player: volume, audio and subtitle tracks, speed, hotkeys, seek bar | `Oblecto-Web/src/components/player/`, `Oblecto-Web/src/playback/` |
| Continue watching | `/movies/watching`, `/episodes/watching`, Jellyfin `/Items/Resume` |
| Accounts: profile, password, avatar, preferences; groups and permissions | `src/submodules/REST/routes/v1/account.ts`, `src/lib/auth/permissions.ts` |
| Loading, empty and error states with retry | `Oblecto-Web/src/components/browse/BrowseState.vue`, `HomeLoadState.vue` |
| CI: lint, typecheck, tests, build, browser suites | `.github/workflows/ci.yml`, `npm run verify` |
| Jellyfin API: sessions, played state, resume, identity | `src/lib/embyEmulation/`, [docs/JELLYFIN.md](docs/JELLYFIN.md) |

## Next

- **Watchlist, favourites and ratings.** No models or routes yet; Jellyfin's favourite and rating endpoints answer 501 until they exist. Needs a migration in `src/submodules/migrations/`.
- **Editing metadata by hand, and bulk actions.** Only artwork can be replaced today.
- **Music.** Undecided. The Jellyfin audio routes answer 404 and the artist routes return empty lists.
- **Tests.** `tests/` still has loose mock typings, so `npm run typecheck` covers `src/` only. The REST user, library and system routes have no route-level specs. `tests/network` has five TVDB assertions that no longer match TVDB's answers.
- **Web UI.** State is split between Vuex (`src/store/`) and Pinia (`src/stores/`); move the rest to Pinia. About half the components use i18n.
- **Jellyfin.** QuickConnect, device and session lists, and remote control of Jellyfin clients.
