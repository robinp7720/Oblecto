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
