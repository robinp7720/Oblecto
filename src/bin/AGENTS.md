# CLI (src/bin/)

Entry points
- `src/bin/oblecto.ts` dispatches CLI commands.
- Built CLI is `dist/bin/oblecto.js` (invoked by `npm run oblecto`; `npm run oblecto:dev` runs the source).
- Command scripts live under `src/bin/scripts/`; shared helpers (opening and migrating the database,
  password prompts) under `src/bin/scripts/helpers/`.

Supported commands
- `start`, `start-tui` (server startup)
- `init [--config-dir DIR] [--force]`, `init database`, `init assets` (config, secret, artwork folders,
  federation key, database)
- `migrate [--status]`
- `adduser`, `deluser`, `changepassword`, `removepassword`, `usergroup`
- `version`, `help`

Notes
- `init` writes to `/etc/oblecto` unless given `--config-dir`; depending on permissions it may require sudo.
- User commands migrate the database first, as `start` does; with `database.migrateOnStart` off they
  refuse a stale schema instead.
- Keep the help output in `oblecto.ts`, the README's command line section and the smoke tests aligned
  with command behavior.

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
