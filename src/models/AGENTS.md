# Models (src/models/)

What lives here
- Sequelize model definitions and column metadata for media, users, and streams.
- Each file exports the model class plus its column definitions.

How to extend
- Add or update fields in the model file and its exported column config.
- Register new models and associations in `src/submodules/database.js`.
- There are no migrations here; schema changes may require a new DB or manual updates.
