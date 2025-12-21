# Infrastructure modules (src/submodules/)

What lives here
- REST API (`REST/`) built on Express.
- Database initialization and model associations (`database.js`).
- Logging (`logger/`), ffmpeg/ffprobe wrappers, guessit integration, zeroconf, utils.

REST API notes
- Entry: `src/submodules/REST/index.js`.
- Routes live under `src/submodules/REST/routes/` with middleware in `src/submodules/REST/middleware/`.
- Shared error helpers live in `src/submodules/REST/errors.js`.

Database notes
- `initDatabase()` in `database.js` registers all models and associations.
- Update this file whenever you add a model or relation in `src/models/`.

Tooling notes
- ffmpeg/ffprobe wrappers are used by streaming and indexing; keep interfaces stable.
- `guessit` is used for filename parsing; avoid changing return shapes without updating callers.
