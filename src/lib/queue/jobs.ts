import type { Movie } from '../../models/movie.js';
import type { Series } from '../../models/series.js';
import type { Episode } from '../../models/episode.js';
import type { File } from '../../models/file.js';
import type Seedbox from '../seedbox/Seedbox.js';

/** The single contract shared by job producers and handlers. */
export interface BackendJobs {
    rescaleImage: { from: string; to: string; width: number; height?: number };
    downloadFile: { url: string; dest: string; overwrite?: boolean };
    analyseFile: number;
    detectSeasonSegments: { seriesId: number; season: string };
    indexMovie: { path: string; doReIndex?: boolean };
    indexEpisode: { path: string };
    identifyMovieFile: { fileId: number };
    identifyEpisodeFile: { fileId: number };
    indexFileStreams: File;
    updateFile: File;
    updateFileHash: File;
    updateFileSize: File;
    updateFileExtension: File;
    updateFileFFProbe: File;
    updateMovie: Movie;
    updateSeries: Series;
    updateEpisode: Episode;
    downloadMoviePoster: Movie;
    downloadMovieFanart: Movie;
    downloadSeriesPoster: Series;
    downloadSeriesFanart: Series;
    downloadEpisodeBanner: Episode;
}

export type ImportJob = { seedbox: Seedbox; origin: string; destination: string };
export interface ImportJobs {
    importMovie: ImportJob;
    importEpisode: ImportJob;
}
