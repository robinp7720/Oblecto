# Infrastructure modules (src/submodules/)

What lives here
- REST API (`REST/`) built on Express 5.
- Database initialization and model associations (`database.ts`), the SQLite driver choice
  (`sqliteDriver.ts`: native `sqlite3` when its binary loads, else `nodeSqlite.ts` over `node:sqlite`),
  and schema migrations (`migrations/`, run with umzug).
- Logging (`logger/`), ffmpeg/ffprobe wrappers, guessit integration, timeouts and utils.

REST API notes
- Entry: `src/submodules/REST/index.ts`.
- Routes live under `src/submodules/REST/routes/` (V1 routes in `routes/v1/`, shared query helpers in
  `routes/helpers/`) with middleware in `src/submodules/REST/middleware/`.
- Shared error helpers live in `src/submodules/REST/errors.ts`.

Database notes
- `initDatabase()` in `database.ts` registers all models and associations.
- Update this file whenever you add a model or relation in `src/models/`, and add a migration.

Tooling notes
- ffmpeg/ffprobe wrappers are used by streaming and indexing; keep interfaces stable.
- `guessit` is used for filename parsing; avoid changing return shapes without updating callers.
