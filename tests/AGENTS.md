# Backend tests (tests/)

What lives here
- Mocha specs in `tests/mocha/`.
- Startup smoke tests: `tests/startup.js` and `tests/startupTui.js`.

How to run
- Unit tests: `npm run test:mocha`.
- Smoke tests: `npm run test:startup` (runs `scripts/test.sh`).

Notes
- `scripts/test.sh` may create `/etc/oblecto` and run `oblecto init`.
- If you change CLI commands or startup flow, update the smoke tests accordingly.
- **Migration**: Tests will be migrated to TS in Phase 6. Ensure type checking is run on tests once migrated.
