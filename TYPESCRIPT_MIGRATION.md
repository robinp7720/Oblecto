# TypeScript Migration Plan

This document outlines the plan for migrating the Oblecto backend code (`src/`) from JavaScript to TypeScript. The goal is to achieve 100% type safety and leverage TypeScript's features for better maintainability and developer experience.

## Strategy

- **Incremental Migration**: We will migrate the codebase file by file or module by module.
- **Strict Mode**: `tsconfig.json` has `"strict": true`. We aim to maintain this standard.
- **No `any`**: Avoid using `any` whenever possible. Define interfaces for complex types.
- **Tests**: Ensure tests pass after each migration step.

## Phases

### Phase 1: Configuration & Infrastructure (Completed)
- [x] Migrate `src/config.ts` (Done) and `src/interfaces/config.ts` (Done).
- [x] Ensure all configuration-related files are TS.
- [x] Verify `tsconfig.json` settings (Done).

### Phase 2: Core Models (`src/models/`) (Completed)
- [x] Create interfaces/types for all Sequelize models.
- [x] Migrate all model definition files to `.ts`.
- [x] Ensure correct typing for Sequelize model associations in class definitions.

### Phase 3: Submodules (`src/submodules/`) (Completed)
- [x] Migrate utility modules (`utils.ts`, `logger/`, `ffmpeg.ts`, `ffprobe.ts`, `guessit.ts`, `zeroconf.ts`).
- [x] Migrate `src/submodules/database.ts` to strictly typed initialization.
- [x] Migrate REST API (`src/submodules/REST/`) including middleware and all routes.

### Phase 4: Library Core (`src/lib/`) (Started)
- [x] Migrate core logic in `src/lib/oblecto/index.ts` (Done).
- [x] Migrate `src/lib/queue/index.ts` (Done).
- [x] Migrate `src/lib/downloader/index.ts` (Done).
- [x] Migrate Indexers (`src/lib/indexers/`). (Series + movies + files done)
- [ ] Migrate Collectors (`src/lib/indexers/` - series/movie collectors).
- [ ] Migrate Updaters (`src/lib/updaters/`).
- [ ] Migrate other services (Artwork, Federation, etc.).

### Phase 5: CLI & Scripts (`src/bin/`, `scripts/`)
- [ ] Migrate CLI entry points (`src/bin/oblecto.js` -> `.ts`).
- [ ] Migrate setup scripts (`src/bin/scripts/`).

### Phase 6: Tests (`tests/`)
- [ ] Migrate Mocha tests to TypeScript (`tests/mocha/`).
- [ ] Ensure test helpers are typed.

## Guidelines for Developers/Agents

1.  **New Files**: MUST be created as `.ts` files.
2.  **Renaming**: When touching a `.js` file for significant changes, rename it to `.ts` and fix type errors.
3.  **Imports**: Update imports to remove `.js` extensions or use correct resolution (TS handles imports differently, often omitting extensions or using `.js` in emit). *Note: In Node ES modules with TS, we often keep `.js` extension in import or use a bundler/loader. Oblecto uses `tsx` for dev, which handles TS on the fly.*
4.  **Types**: Define interfaces in `src/interfaces/` if they are shared, or locally if specific to a module.

## Tracking Progress

Update this file (check off items) as migration proceeds.
Update `AGENTS.md` in relevant directories to reflect the TS requirement.
