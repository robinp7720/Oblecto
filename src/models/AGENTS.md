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
