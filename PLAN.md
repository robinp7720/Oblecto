# Oblecto Missing Features Implementation Plan

## Purpose
This document is the implementation-ready backlog for key product and quality gaps in Oblecto.
Use it as the default starting point for future agent runs.

## Scope
- Backend: `src/`
- Default web frontend: `Oblecto-Web/`
- Test and quality tooling: `tests/`, `package.json`, `qodana.yaml`, `eslint.config.js`
- Jellyfin/Emby emulation: `src/lib/embyEmulation/`

## How to Use This Plan
1. Pick the highest-priority open item.
2. Read the linked files for that item.
3. Implement the listed deliverables.
4. Add or update tests per the test notes.
5. Update this document with status and follow-ups.

## Priority Summary
| ID | Feature Track | Priority | Impact | Suggested First Slice |
|---|---|---|---|---|
| F1 | Library browsing controls | P0 | High | Add query-driven filtering/sorting for Movies page |
| F2 | Playback UX parity | P0 | High | Add volume + subtitle/audio selection in player UI |
| F3 | Continue Watching + watchlist/favorites/ratings | P0 | High | Add Continue Watching rail on main page |
| F4 | User self-service and preferences | P1 | High | Add Account page route and password change flow |
| F5 | Media edit parity and bulk operations | P1 | Medium | Add Movie metadata edit modal + API endpoint |
| F6 | Emby/Jellyfin compatibility completion | P1 | High | Implement QuickConnect or explicit unsupported response contract |
| F7 | Decide music support path | P2 | Medium | Architecture decision + stub policy + docs |
| F8 | Frontend resiliency states | P0 | Medium | Add consistent loading/empty/error states for Movies/Series/Search |
| F9 | CI quality gates and unified checks | P0 | High | Add one repo-level verify script + CI workflow |
| F10 | Integration and e2e coverage | P0 | High | Add API integration test suite bootstrapping |

## F1: Library Browsing Controls (Filters, Sort, Pagination)
### Current Gap
Movies/Series pages are rail-driven and lack full browse controls for large libraries.

### Key Files
- `Oblecto-Web/src/components/pages/Movies.vue`
- `Oblecto-Web/src/components/pages/Series.vue`
- `Oblecto-Web/src/components/itemLists/*.vue`
- `Oblecto-Web/src/store/index.js`
- `src/submodules/REST/routes/movies.ts`
- `src/submodules/REST/routes/tvshows.ts`

### Deliverables
- Queryable list mode for movies and series.
- Filter controls: genre, year, watched/unwatched, library/source.
- Sort controls: title, date added, rating, release date.
- Pagination or infinite scroll with stable cursor/offset behavior.
- URL-state sync for shareable filtered views.

### Implementation Notes
- Prefer backend-supported filtering/sorting to avoid pulling full libraries client-side.
- Keep rail mode available, but add a discover/browse mode as default for large libraries.

### Test Notes
- Add backend tests for filter/sort query params.
- Add frontend component tests for query state changes and rendering.
- Add regression test for pagination boundary conditions.

### Definition of Done
- User can browse 10k+ items with responsive filtering and sorting.
- Page reload preserves active browse state.

## F2: Playback UX Parity
### Current Gap
Core playback works, but controls are missing compared to modern media clients.

### Key Files
- `Oblecto-Web/src/components/playBar.vue`
- `Oblecto-Web/src/components/files/FileList.vue`
- `src/submodules/REST/routes/streaming.ts`
- `src/lib/mediaSessions/MediaSessionController.ts`

### Deliverables
- Volume/mute controls.
- Audio track and subtitle track selection.
- Subtitle enable/disable and default behavior.
- Playback speed controls.
- Keyboard shortcuts for play/pause/seek/volume/fullscreen.
- Improved seek UI with visible buffered/progress states.

### Implementation Notes
- Track selection metadata may require endpoint enrichment if not currently exposed.
- Ensure controls work for both direct play and transcoded/HLS modes.

### Test Notes
- Add player interaction tests for keyboard shortcuts and track switching.
- Add API tests for stream metadata payloads when multiple tracks exist.

### Definition of Done
- Playback features are parity-acceptable for daily use without external client fallback.

## F3: Continue Watching + Watchlist/Favorites/Ratings
### Current Gap
Progress exists in watch panel but personal discovery features are fragmented.

### Key Files
- `Oblecto-Web/src/components/pages/Main.vue`
- `Oblecto-Web/src/components/WatchPanel.vue`
- `Oblecto-Web/src/components/itemTypes/Movie.vue`
- `Oblecto-Web/src/components/itemTypes/Episode.vue`
- `src/models/trackMovie.ts`
- `src/models/trackEpisode.ts`
- `src/submodules/REST/routes/movies.ts`
- `src/submodules/REST/routes/episodes.ts`

### Deliverables
- Dedicated Continue Watching rail on home.
- User watchlist feature for movies and series.
- Favorite toggles and personal ratings.
- API endpoints and DB persistence for watchlist/favorite/rating states.
- UI badges/buttons for quick add/remove.

### Implementation Notes
- Reuse current tracking models where possible; add new models only if required.
- Keep behavior per-user and authenticated.

### Test Notes
- Add model and route tests for create/read/update/delete user preference states.
- Add frontend tests for optimistic toggles and rollback on API failure.

### Definition of Done
- Authenticated users can manage and revisit personal queues without manual search.

## F4: User Self-Service and Preferences
### Current Gap
User admin exists, but self-service account operations and preferences are missing.

### Key Files
- `Oblecto-Web/src/router/index.js`
- `Oblecto-Web/src/components/pages/Settings.vue`
- `Oblecto-Web/src/components/settings/UserManager.vue`
- `src/submodules/REST/routes/auth.ts`
- `src/bin/scripts/changepassword.ts`
- `src/lib/embyEmulation/ServerAPI/routes/users/index.ts`

### Deliverables
- Account page for current user.
- Change password flow in web UI.
- Basic profile settings: playback defaults, autoplay next, subtitle preference.
- Role-aware settings visibility (admin vs standard user).

### Implementation Notes
- Avoid exposing admin-only routes in UI for non-admin users.
- Reuse backend auth primitives rather than duplicating password logic.

### Test Notes
- Add auth route tests for password change validation and permission checks.
- Add UI tests for role-based settings rendering.

### Definition of Done
- Non-admin users can manage their own account preferences safely.

## F5: Media Edit Parity and Bulk Operations
### Current Gap
Show-level editing exists, but movie/episode edit workflows are incomplete.

### Key Files
- `Oblecto-Web/src/components/modals/ShowModify.vue`
- `Oblecto-Web/src/components/modals/MovieDialog.vue`
- `Oblecto-Web/src/components/modals/EpisodeDialog.vue`
- `src/submodules/REST/routes/movies.ts`
- `src/submodules/REST/routes/episodes.ts`

### Deliverables
- Movie metadata edit modal with validation.
- Episode metadata edit modal with validation.
- Bulk actions for selected items: refresh metadata, rescan, artwork refresh.
- Confirmation and undo-safe UX for destructive operations.

### Implementation Notes
- Keep auditability of metadata changes where possible.
- Ensure edit actions trigger appropriate updater/indexer tasks.

### Test Notes
- Route tests for edit endpoints and validation errors.
- Frontend tests for form validation and confirmation flows.

### Definition of Done
- Metadata management is consistent across shows, movies, and episodes.

## F6: Emby/Jellyfin Compatibility Completion
### Current Gap
Core browsing/streaming works, but several routes are stubs or placeholders.

### Key Files
- `src/lib/embyEmulation/PLAN.md`
- `ARE_WE_JELLY_YET.md`
- `src/lib/embyEmulation/ServerAPI/routes/quickconnect/index.ts`
- `src/lib/embyEmulation/ServerAPI/routes/users/index.ts`
- `src/lib/embyEmulation/ServerAPI/routes/plugins/index.ts`
- `src/lib/embyEmulation/ServerAPI/routes/others/index.ts`
- `src/lib/embyEmulation/ServerAPI/routes/items/index.ts`

### Deliverables
- Prioritized route completion list based on client breakage frequency.
- Replace high-impact stubs with real behavior or explicit unsupported contract.
- Fix auth/user-management gaps returning 501 where feasible.
- Improve endpoint consistency for images/downloads/subtitle-related routes.

### Implementation Notes
- Use `src/lib/embyEmulation/PLAN.md` as the route-level backlog.
- Prefer “honest unsupported + stable schema” over misleading success responses.

### Test Notes
- Add compatibility tests for top client flows: login, browse, playback, progress, favorites.
- Add contract tests for endpoints that intentionally remain unsupported.

### Definition of Done
- Common Jellyfin/Emby client paths work without brittle fallbacks.

## F7: Music Support Decision and Path
### Current Gap
Music endpoints are mostly stubbed; product direction is unclear.

### Key Files
- `src/lib/embyEmulation/ServerAPI/routes/artists/index.ts`
- `src/lib/embyEmulation/ServerAPI/routes/items/index.ts`
- `src/lib/indexers/`
- `ARE_WE_JELLY_YET.md`

### Deliverables
- Written architecture decision: full music support vs explicit non-goal.
- If in scope: indexer/data model/API/UI implementation plan.
- If out of scope: consistent unsupported responses and documentation updates.

### Implementation Notes
- Do not continue with indefinite stub behavior.
- Make this decision before large emulation backlog work.

### Test Notes
- Add tests for whichever policy is chosen.

### Definition of Done
- Music behavior is explicit, documented, and consistently enforced.

## F8: Frontend Resiliency States
### Current Gap
Inconsistent loading/empty/error recovery patterns across key pages.

### Key Files
- `Oblecto-Web/src/components/pages/Movies.vue`
- `Oblecto-Web/src/components/pages/Series.vue`
- `Oblecto-Web/src/components/pages/Search.vue`
- `Oblecto-Web/src/components/pages/Main.vue`
- `Oblecto-Web/src/store/index.js`

### Deliverables
- Shared state components for loading, empty result, network error.
- Retry actions and fallback messaging.
- Standardized store conventions for async status and errors.

### Implementation Notes
- Introduce a small reusable state pattern to avoid page-level divergence.

### Test Notes
- Component tests for each state and retry behavior.

### Definition of Done
- All major pages render deterministic loading/error/empty states.

## F9: CI Quality Gates and Unified Checks
### Current Gap
Quality checks are fragmented and not enforced by a single CI gate.

### Key Files
- `package.json`
- `Oblecto-Web/package.json`
- `jellyfin-web/package.json`
- `qodana.yaml`
- `eslint.config.js`
- `.github/`

### Deliverables
- One root-level verify command covering lint + test + build sanity.
- CI workflow that runs on pull requests.
- Coverage thresholds for backend tests.
- Documented policy for legacy `Oblecto-Web` test execution.

### Implementation Notes
- Keep CI runtime reasonable; split jobs if needed.
- Make failures actionable with clear command parity locally.

### Test Notes
- Validate pipeline on a branch PR before enforcing required status.

### Definition of Done
- Regressions are blocked automatically by CI.

## F10: Integration and E2E Coverage Expansion
### Current Gap
Unit tests exist, but API integration and frontend e2e coverage are thin.

### Key Files
- `tests/mocha/*.spec.ts`
- `tests/startup.ts`
- `tests/startupTui.ts`
- `Oblecto-Web/test/unit/karma.conf.js`
- `Oblecto-Web/test/e2e/nightwatch.conf.js`

### Deliverables
- API integration test harness with test DB and seeded fixtures.
- Critical-path tests: auth, browse, playback session lifecycle, progress sync.
- Decision on frontend e2e framework refresh (keep Nightwatch vs migrate).
- Smoke e2e covering login -> browse -> play -> progress update.

### Implementation Notes
- Start with a small deterministic integration suite before broad expansion.
- Keep test fixture setup isolated from production config paths.

### Test Notes
- Ensure tests run in CI headlessly and do not require manual setup.

### Definition of Done
- Critical user journeys are covered by automated tests beyond unit level.

## Recommended Execution Order
1. F9 CI gates first, so later work is protected.
2. F8 resiliency states to reduce UX instability.
3. F1 browse controls for day-to-day usability.
4. F2 playback controls for core consumption quality.
5. F3 personal discovery features.
6. F10 integration/e2e hardening in parallel with feature work.
7. F4 self-service account and preferences.
8. F5 media edit parity.
9. F6 emulation completion with route-level prioritization.
10. F7 music direction decision before deeper music API changes.

## Cross-Cutting Technical Rules
- Keep ESM patterns and existing module conventions.
- Do not edit build output directories (`dist/`, `Oblecto-Web/dist/`).
- Add tests alongside each feature track.
- Prefer incremental PRs with one primary feature objective each.

## Agent Kickoff Checklist
- Read this file and pick the highest-priority open track.
- Inspect the listed files for that track.
- Implement the first slice and ship with tests.
- Update this file status notes and remaining tasks.

## Status
- Date: 2026-02-10
- Plan owner: Repository maintainers and contributing agents
- Current state: Backlog defined, implementation not started in this file
