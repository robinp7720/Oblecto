# Backend server (src/)

Entry points
- `src/index.ts` -> `src/core/index.ts` starts the server; `src/core/graphical.ts` is the TUI (`start-tui`).
- `src/bin/oblecto.ts` provides the CLI (see `src/bin/AGENTS.md`).

Core architecture
- `src/core/index.ts` checks the configuration (`lib/settings/startupChecks.ts`), brings the database up
  to date (`core/database.ts`), then constructs `lib/oblecto`. `core/lifecycle.ts` handles signals.
- `src/lib/oblecto` wires the queue, indexers, collectors, updaters, cleaners, artwork, playback,
  seedboxes, federation, the REST API, the realtime socket and the Jellyfin emulation.
- REST API lives in `src/submodules/REST` (Express 5).
- Database initialization and associations live in `src/submodules/database.ts`, using models from
  `src/models/`; schema changes are migrations in `src/submodules/migrations/index.ts`.

Conventions
- All source is TypeScript (`.ts`), imported with `.js` extensions (ESM).
- Most services are classes that accept the `Oblecto` instance and store `this.oblecto`.
- Background work is scheduled through `lib/queue` (register jobs in constructors).
- Long-lived components should expose `close()` so `core.close()` can clean up.

When changing
- Config schema: update `src/interfaces/config.ts`, `res/config.json`, the validation in
  `src/lib/settings/validation.ts`, and the README's configuration table.
- New models or relations: add files in `src/models/`, wire them in `src/submodules/database.ts`, and add
  a migration.
- New API endpoints: add route handlers under `src/submodules/REST/routes` (register them in
  `routes/index.ts`) and document them in `docs/API.md`.

Build/test
- `npm run dev` for live dev (tsx).
- `npm run build:server` produces `dist/index.js` and `dist/bin/oblecto.js`.
- `npm run verify` runs lint, the typecheck and mocha, as CI does.
