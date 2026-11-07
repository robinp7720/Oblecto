import path from 'node:path';
import { QueryTypes, type Sequelize } from 'sequelize';
import type { IConfig } from '../../interfaces/config.js';

export interface LibraryStatistics {
    type: 'movies' | 'tvshows';
    path: string;
    movies: number;
    series: number;
    episodes: number;
    files: number;
    localBytes: number;
    missingSize: number;
    problematicFiles: number;
}

/** Current indexed local inventory; overlapping roots deliberately include the same files. */
export async function libraryStatistics(database: Sequelize, config: Pick<IConfig, 'movies' | 'tvshows'>): Promise<LibraryStatistics[]> {
    const libraries = (['movies', 'tvshows'] as const).flatMap(type => config[type].directories.map(directory => ({
        row: {
            type, path: directory.path, movies: 0, series: 0, episodes: 0, files: 0, localBytes: 0, missingSize: 0, problematicFiles: 0
        },
        root: path.resolve(directory.path),
        movies: new Set<number>(),
        episodes: new Set<number>(),
        series: new Set<number>()
    })));
    if (!libraries.length) return [];

    const generator = database.getQueryInterface().queryGenerator as { quoteIdentifier(value: string): string };
    const q = (name: string): string => generator.quoteIdentifier(name);
    type IndexedFile = { id: number; path: string; size: number | string | null; problematic: boolean | number };
    type MovieLink = { FileId: number; MovieId: number };
    type EpisodeLink = { FileId: number; EpisodeId: number; SeriesId: number | null };
    // Bound each read and avoid fetching large playback metadata or model instances.
    const [ceiling] = await database.query<{ id: number | null }>(`SELECT MAX(${q('id')}) AS ${q('id')} FROM ${q('Files')}`, { type: QueryTypes.SELECT });
    let after = 0;
    while (after < Number(ceiling.id ?? 0)) {
        const files = await database.query<IndexedFile>(`SELECT ${['id', 'path', 'size', 'problematic'].map(q).join(',')}
            FROM ${q('Files')} WHERE ${q('id')} > :after AND ${q('id')} <= :ceiling
            AND (${q('host')} IS NULL OR ${q('host')} = 'local' OR ${q('host')} = '') AND ${q('path')} IS NOT NULL
            ORDER BY ${q('id')} LIMIT 500`, { replacements: { after, ceiling: ceiling.id }, type: QueryTypes.SELECT });
        if (!files.length) break;
        after = files[files.length - 1].id;
        const membership = new Map<number, typeof libraries>();
        for (const file of files) {
            if (!file.path) continue;
            const matches = libraries.filter(library => {
                const relative = path.relative(library.root, path.resolve(file.path));
                return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
            });
            if (!matches.length) continue;
            membership.set(file.id, matches);
            for (const { row } of matches) {
                row.files++;
                row.localBytes += Number(file.size ?? 0);
                if (file.size === null) row.missingSize++;
                if (file.problematic === true || file.problematic === 1) row.problematicFiles++;
            }
        }
        if (!membership.size) continue;
        const options = { replacements: { ids: [...membership.keys()] }, type: QueryTypes.SELECT as const };
        const [movies, episodes] = await Promise.all([
            database.query<MovieLink>(`SELECT mf.${q('FileId')}, mf.${q('MovieId')} FROM ${q('MovieFiles')} mf
                JOIN ${q('Movies')} m ON m.${q('id')} = mf.${q('MovieId')} WHERE mf.${q('FileId')} IN (:ids)`, options),
            database.query<EpisodeLink>(`SELECT ef.${q('FileId')}, ef.${q('EpisodeId')}, s.${q('id')} AS ${q('SeriesId')}
                FROM ${q('EpisodeFiles')} ef JOIN ${q('Episodes')} e ON e.${q('id')} = ef.${q('EpisodeId')}
                LEFT JOIN ${q('Series')} s ON s.${q('id')} = e.${q('SeriesId')} WHERE ef.${q('FileId')} IN (:ids)`, options)
        ]);
        for (const link of movies) for (const library of membership.get(link.FileId) ?? []) library.movies.add(link.MovieId);
        for (const link of episodes) for (const library of membership.get(link.FileId) ?? []) {
            library.episodes.add(link.EpisodeId);
            if (link.SeriesId !== null) library.series.add(link.SeriesId);
        }
    }
    return libraries.map(({ row, movies, series, episodes }) => ({
        ...row, movies: movies.size, series: series.size, episodes: episodes.size
    }));
}
