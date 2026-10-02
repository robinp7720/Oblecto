# Tests (tests/)

What lives here
- Mocha specs in `tests/mocha/`, reading `tests/fixtures/config.json`.
- Specs that call the real TMDb, TVDB and fanart.tv APIs in `tests/network/` (opt-in).
- Startup smoke tests: `tests/startup.ts` (the built server) and `tests/startupTui.ts`.
- Shared helpers in `tests/helpers/` (`federationServer.ts` starts a real server process for the federation
  integration spec).
- Playwright suites in `tests/browser/`: `playback.spec.ts` drives PlaybackController against a real
  PlaybackService; `ui/*.spec.mjs` drive the Vue app against a stubbed API.

How to run
- Unit tests: `npm test`.
- Network tests: `npm run test:network`, with the project keys from `res/config.json`; set `OBLECTO_TMDB_KEY`,
  `OBLECTO_TVDB_KEY` or `OBLECTO_FANART_KEY` to use others.
- Smoke tests: `npm run test:startup` after `npm run build`, or set `OBLECTO_SERVER_BUNDLE` to test
  another bundle without touching `dist/`.
- Browser tests: `npm run test:playback:browser`, `npm run test:player:ui`.

Notes
- Smoke tests use a throwaway config, in-memory database and ephemeral ports.
- The federation and playback specs need OpenSSL, FFmpeg and ffprobe; they generate their certificates and
  media in temporary directories.
- `npm run typecheck` does not cover `tests/` yet (the mocks are loosely typed); keep new specs typed anyway.
- Model classes are shared across specs; when a spec declares associations, check
  `Model.associations` first so it does not add a second alias.
- If you change CLI commands or startup flow, update the smoke tests accordingly.
