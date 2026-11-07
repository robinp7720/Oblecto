# Tests (tests/)

What lives here
- Mocha specs in `tests/mocha/`, reading `tests/fixtures/config.json`.
- Specs that call the real TMDb, TVDB and fanart.tv APIs in `tests/network/` (opt-in).
- Startup smoke tests: `tests/startup.ts` (the built server) and `tests/startupTui.ts`, and `tests/startupFailure.ts`.
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
- `npm run typecheck` covers `src/` and all test TypeScript, including network, startup and browser fixtures. Keep fixtures typed; use `tests/helpers/routes.ts` for isolated route responses and `tests/types/` for compile-only contracts. Route helpers omit middleware, so use a real HTTP server when testing authentication or global request validation.
- Model classes are shared across specs; when a spec declares associations, check
  `Model.associations` first so it does not add a second alias.
- If you change CLI commands or startup flow, update the smoke tests accordingly.

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
