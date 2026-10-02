# Resources (res/)

What lives here
- `config.json` holds the default configuration. `src/config.ts` fills every key missing from the
  active config file from it, and `oblecto init` copies it as the template for a new config.

Notes
- Update this file only when changing default config values or schema.
- Keep keys aligned with `src/interfaces/config.ts`, the settings validation in
  `src/lib/settings/validation.ts`, and the configuration table in `README.md`.
- The TMDb, TVDB and fanart.tv keys are the project's own and are meant to ship.
