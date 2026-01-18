# CLI (src/bin/)

Entry points
- `src/bin/oblecto.js` dispatches CLI commands.
- Built CLI is `dist/bin/oblecto.js` (invoked by `npm run oblecto`).
- Command scripts live under `src/bin/scripts/`.

Supported commands
- `start`, `start-tui` (server startup)
- `init` (setup config/assets/database)
- `adduser`, `deluser`, `changepassword`, `removepassword`

Notes
- `init` writes to `/etc/oblecto`; depending on permissions it may require sudo.
- Keep the help output in `oblecto.js` aligned with command behavior.
- **Migration**: CLI scripts are scheduled for Phase 5 of the TS migration.
