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
