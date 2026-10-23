# Resources (res/)

What lives here
- `config.json` holds the default configuration. `src/config.ts` fills every key missing from the
  active config file from it, and `oblecto init` copies it as the template for a new config.

Notes
- Update this file only when changing default config values or schema.
- Keep keys aligned with `src/interfaces/config.ts`, the settings validation in
  `src/lib/settings/validation.ts`, and the configuration table in `README.md`.
- The TMDb, TVDB and fanart.tv keys are the project's own and are meant to ship.

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
