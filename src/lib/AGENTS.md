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
