# Oblecto repository guide

Scope
- Backend Node/ESM server lives in `src/`.
- Default Vue 2 frontend lives in `Oblecto-Web/` and builds to `Oblecto-Web/dist/`.
- Backend tests are in `tests/`; helper scripts in `scripts/`.

Quick commands (from repo root)
- `npm run dev` (backend dev server via tsx)
- `npm run build` (full build: both frontends plus the backend bundle in `dist/`)
- `npm run build:server` (backend bundle only)
- `npm run start` (run built backend)
- `npm run oblecto` / `npm run oblecto:dev` (CLI)
- `npm run build:web` (Oblecto-Web build; runs npm ci inside `Oblecto-Web/`)
- `npm run build:jellyfin-web` (Jellyfin web build; runs npm ci inside `jellyfin-web/`)
- `npm test` / `npm run test:mocha` / `npm run test:startup`

Config and data
- Config is read from `/etc/oblecto/config.json` (see `src/config.ts`).
- Default sqlite DB is `/etc/oblecto/database.sqlite` (see `src/submodules/database.js`).
- External metadata uses TVDB/TMDB keys from config.

Conventions
- ESM modules (`package.json` has `"type": "module"`).
- `dist/` and `Oblecto-Web/dist/` are build outputs; avoid editing.
- `node_modules/` and `Oblecto-Web/node_modules/` are vendor.
