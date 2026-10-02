# Scripts (scripts/)

What lives here
- `test.sh` (`npm run test:startup`) runs the startup smoke tests, `tests/startup.ts` and
  `tests/startupTui.ts`, with a throwaway config and in-memory databases. It never touches
  `/etc/oblecto`.
- `fetch-jellyfin-openapi.sh` downloads `jellyfin-openapi-stable.json`, the spec the Jellyfin
  emulation is compared against (see `src/lib/embyEmulation/PLAN.md`).

Notes
- The smoke tests start the built server, so run `npm run build:server` first, or set
  `OBLECTO_SERVER_BUNDLE` to a bundle outside `dist/`.
