# Domain services (src/lib/)

What lives here
- Indexers, collectors, updaters, cleaners for movies/series/files.
- Artwork processing and downloading.
- Queue + background job orchestration.
- Streaming sessions, realtime, federation, seedbox, emby emulation.

Common patterns
- Classes accept the `Oblecto` instance in the constructor and keep `this.oblecto` for shared services.
- Use `this.oblecto.queue` to register and enqueue background work (`registerJob`, `queueJob`, `pushJob`).
- Log through `src/submodules/logger` instead of `console` for system logs.

Adding new behavior
- Prefer adding a new service class and wire it in `lib/oblecto` so it is constructed once.
- Register queue jobs in the constructor so they are available at startup.
- Keep file and network work async and avoid blocking the event loop.
