# Domain services (src/lib/)

What lives here
- Indexers, collectors, updaters and cleaners for movies, series and files (`indexers/`, `updaters/`,
  `cleaners/`); credits and people (`updaters/common/CreditSync.ts`, `people/`).
- Artwork processing and downloading (`artwork/`).
- Queue and maintenance job tracking (`queue/`, `maintenance/`).
- Playback sessions and transcoding (`playback/`, see `docs/STREAMING.md`).
- Accounts: tokens, permissions, sign-in policy and throttling (`auth/`); avatars, preferences,
  passwords and favourites (`users/`).
- Settings validation and the config writer (`settings/`), local network and CORS rules (`network/`).
- Realtime socket (`realtime/`), federation (`federation/`, see `docs/FEDERATION.md`), seedbox imports
  (`seedbox/`), and the Jellyfin emulation (`embyEmulation/`, see its own `AGENTS.md`).

Common patterns
- Classes accept the `Oblecto` instance in the constructor and keep `this.oblecto` for shared services.
- Use `this.oblecto.queue` to register and enqueue background work (`registerJob`, `queueJob`, `pushJob`).
- Log through `src/submodules/logger` instead of `console` for system logs.
- Tell open web clients about library changes with `this.oblecto.realTimeController?.broadcast('indexer', …)`
  (see `docs/REALTIME_API.md`).

Adding new behavior
- Prefer adding a new service class and wire it in `lib/oblecto` so it is constructed once.
- Register queue jobs in the constructor so they are available at startup.
- Keep file and network work async and avoid blocking the event loop.
- Define interfaces for job payloads.
