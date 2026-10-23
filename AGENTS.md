# Oblecto repository guide

Scope
- Backend Node/ESM server lives in `src/`.
- Default Vue 3 + Vite frontend lives in `Oblecto-Web/` and builds to `Oblecto-Web/dist/`.
- Backend tests are in `tests/`; helper scripts in `scripts/`.
- The Jellyfin web client is the `jellyfin-web/` submodule, copied into `dist/` by the build.
- User and API documentation is in `README.md` and `docs/`; the roadmap is `PLAN.md`, release notes `CHANGELOG.md`.
  Change them with the behaviour they describe.

Quick commands (from repo root)
- `npm run dev` (backend dev server via tsx)
- `npm run build` (full build: both frontends plus the backend bundle in `dist/`)
- `npm run build:server` (backend bundle only)
- `npm run start` (run built backend)
- `npm run oblecto` / `npm run oblecto:dev` (CLI)
- `npm run build:web` (Oblecto-Web build; runs npm ci inside `Oblecto-Web/`)
- `npm run build:jellyfin-web` (Jellyfin web build; runs npm ci inside `jellyfin-web/`)
- `npm run verify` (lint:src, typecheck and mocha, as CI runs them)
- `npm test` / `npm run test:startup` / `npm run test:network` (live metadata APIs, opt-in)

Config and data
- Config is read from `OBLECTO_CONFIG_PATH`, else `/etc/oblecto/config.json` (see `src/config.ts`); missing keys come from `res/config.json`.
- Mocha reads `tests/fixtures/config.json`; never point tests or scratch servers at a real config.
- Default sqlite DB is `/etc/oblecto/database.sqlite` (see `src/submodules/database.ts`).
- Schema changes need a migration in `src/submodules/migrations/index.ts`: add a new one, never edit a released one.
- External metadata uses TVDB/TMDB keys from config.

Conventions
- ESM modules (`package.json` has `"type": "module"`).
- `dist/` and `Oblecto-Web/dist/` are build outputs; avoid editing.
- `node_modules/` and `Oblecto-Web/node_modules/` are vendor.

## Completion: commit and push

- Unless the user explicitly asks otherwise, completing a task includes committing and pushing all
  working-tree changes, including pre-existing edits and new files. This is standing authorization;
  do not ask for separate confirmation to commit or push.
- Run checks appropriate to the changes, preserve existing work, stage all repository changes, and
  create a descriptive commit. Push the current branch to its configured remote without force.
- Commit and push changed submodules first, then commit and push the parent repository with the
  updated submodule references.
- When multiple agents share a checkout, coordinate one final commit and push after all workers
  finish their changes.
- Verify that the push succeeded and the working trees are clean. Report the commit IDs and any
  check or push failures.
