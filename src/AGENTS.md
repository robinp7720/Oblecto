# Backend server (src/)

Entry points
- `src/index.js` -> `src/core/index.js` starts the server.
- `src/bin/oblecto.js` provides the CLI (see `src/bin/AGENT.md`).

Core architecture
- `src/core/index.js` instantiates `lib/oblecto` and keeps the lifecycle.
- `src/lib/oblecto` wires queue, indexers, collectors, updaters, artwork, REST API, federation, emby emulation, etc.
- REST API lives in `src/submodules/REST` (Express).
- Database initialization and associations live in `src/submodules/database.js` using models from `src/models/`.

Conventions
- Most services are classes that accept the `Oblecto` instance and store `this.oblecto`.
- Background work is scheduled through `lib/queue` (register jobs in constructors).
- Long-lived components should expose `close()` so `core.close()` can clean up.
- **TypeScript**: The project is migrating to TS. Use `.ts` for new files.

When changing
- Config schema: update `src/interfaces/config.ts` and usage in `src/config.ts`.
- New models or relations: add files in `src/models/` and wire in `src/submodules/database.js`.
- New API endpoints: add route handlers under `src/submodules/REST/routes` and register in `src/submodules/REST/index.js`.

Build/test
- `npm run dev` for live dev (tsx).
- `npm run build` produces `dist/`, which tests and CLI consume.
