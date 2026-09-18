import type Oblecto from '../oblecto/index.js';

export function maintenanceWork(oblecto: Oblecto, action: string, target: string): (() => Promise<void>) | undefined {
    const tasks: Record<string, Record<string, () => unknown>> = {
        scan: {
            series: () => oblecto.seriesCollector.collectAll(),
            movies: () => oblecto.movieCollector.collectAll()
        },
        update_artwork: {
            series: () => oblecto.seriesArtworkCollector.collectAll(),
            movies: () => oblecto.movieArtworkCollector.collectAll()
        },
        update_metadata: {
            series: () => oblecto.seriesUpdateCollector.collectAllSeries(),
            episodes: () => oblecto.seriesUpdateCollector.collectAllEpisodes(),
            movies: () => oblecto.movieUpdateCollector.collectAllMovies(),
            files: () => oblecto.fileUpdateCollector.collectAllFiles()
        },
        clean: {
            files: async () => { await oblecto.fileCleaner.removeAssoclessFiles(); await oblecto.fileCleaner.removedDeletedFiled(); },
            episodes: () => oblecto.seriesCleaner.removeFileLessEpisodes(),
            movies: () => oblecto.movieCleaner.removeFileLessMovies(),
            series: () => oblecto.seriesCleaner.removeEpisodeslessShows()
        }
    };
    if (!Object.hasOwn(tasks, action)) return;
    const group = tasks[action];
    let selected: (() => unknown)[];
    if (target === 'all') {
        selected = Object.values(group);
        if (action === 'clean') selected.push(() => oblecto.seriesCleaner.removePathLessShows());
    }
    else if (target === 'tvshows') {
        selected = action === 'clean'
            ? [group.episodes, group.series, () => oblecto.seriesCleaner.removePathLessShows()]
            : action === 'update_metadata' ? [group.series, group.episodes] : [group.series];
    } else if (Object.hasOwn(group, target)) selected = [group[target]];
    else return;
    return async () => {
        // Sequential ordering keeps episode cleanup ahead of empty-series cleanup.
        const failures: unknown[] = [];
        for (const task of selected) {
            try { await task(); } catch (error) { failures.push(error); }
        }
        if (failures.length) throw new AggregateError(failures, 'Maintenance failed');
    };
}
