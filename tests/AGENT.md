# Backend tests (tests/)

What lives here
- Mocha specs in `tests/mocha/`.
- Startup smoke tests: `tests/startup.js` and `tests/startupTui.js`.

How to run
- Build first: `npm run build` (tests use `dist/`).
- Unit tests: `npm run test:mocha`.
- Smoke tests: `npm run test:startup` (runs `scripts/test.sh`).

Notes
- `scripts/test.sh` may create `/etc/oblecto` and run `oblecto init`.
- If you change CLI commands or startup flow, update the smoke tests accordingly.
