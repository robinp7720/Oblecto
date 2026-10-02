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
