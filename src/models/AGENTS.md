# Models (src/models/)

What lives here
- Sequelize model definitions and column metadata for media, credits and people, files and streams,
  users, groups, favourites, watch progress, Jellyfin display preferences and federation records.
- Each file exports the model class plus its column definitions.

How to extend
- Add or update fields in the model file and its exported column config.
- Register new models and associations in `src/submodules/database.ts`.
- Every schema change needs a new migration in `src/submodules/migrations/index.ts`. Never edit one that
  has been released; migrations only add tables and columns, and check before adding so hand-upgraded
  databases pass.
- Cover the migration in `tests/mocha/migrations.spec.ts`.

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
