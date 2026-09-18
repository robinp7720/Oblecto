import { promises as fs } from 'fs';
import path from 'path';

import type { File, ProblemStage } from '../../../models/file.js';
import type Oblecto from '../../oblecto/index.js';

type ProblemOblecto = Pick<Oblecto, 'config' | 'queue'> & {
    realTimeController?: Pick<Oblecto['realTimeController'], 'broadcast'>;
};

const broadcast = (oblecto: ProblemOblecto, file: File): void => {
    oblecto.realTimeController?.broadcast('indexer', {
        event: 'problem',
        fileId: file.id,
        problematic: file.problematic,
        problemStage: file.problemStage,
        error: file.error
    });
};

/**
 * Flag a file as problematic, recording which stage of indexing failed.
 * @param oblecto - Oblecto server instance
 * @param file - File that failed
 * @param stage - Stage that failed
 * @param message - Human readable reason
 */
export async function markProblematic(oblecto: ProblemOblecto, file: File, stage: ProblemStage, message: string): Promise<void> {
    file.set({
        problematic: true,
        problemStage: stage,
        error: withoutPath(message, file.path)
    });

    // Save even when a retry failed the same way again, so `updatedAt`
    // reflects the latest attempt
    file.changed('updatedAt', true);
    await file.save();

    broadcast(oblecto, file);
}

/**
 * Drop the file's own path from an error message; it is shown next to the
 * error anyway and pushes the actual reason out of view.
 * "Could not identify: /movies/x.mkv (TMDB: no results)" becomes
 * "Could not identify (TMDB: no results)".
 * @param message - Error message
 * @param filePath - Path of the file the message is about
 * @returns - Message without the path
 */
function withoutPath(message: string, filePath: string | null): string {
    if (filePath === null || filePath === '' || !message.includes(filePath)) return message;

    const stripped = message
        .split(filePath).join('')
        .replace(/:\s*(?=\(|$)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return stripped === '' ? message : stripped;
}

/**
 * Clear a file's problem after `stage` succeeded. A problem recorded for a
 * different stage is left alone, so e.g. a successful probe does not hide the
 * fact that the file was never identified. Rows flagged before stages were
 * recorded have no stage and are cleared by either.
 * @param oblecto - Oblecto server instance
 * @param file - File that was processed successfully
 * @param stage - Stage that succeeded
 */
export async function clearProblem(oblecto: ProblemOblecto, file: File, stage: ProblemStage): Promise<void> {
    if (!file.problematic) return;
    if (file.problemStage !== null && file.problemStage !== undefined && file.problemStage !== stage) return;

    await file.update({
        problematic: false,
        problemStage: null,
        problemIgnored: false,
        error: null
    });

    broadcast(oblecto, file);
}

/**
 * Whether `filePath` lies inside `directory`. A plain prefix check would also
 * match siblings such as `/media/Movies2` for `/media/Movies`.
 * @param directory - Library directory
 * @param filePath - Path to test
 * @returns - True if the file is inside the directory
 */
export function isInDirectory(directory: string, filePath: string): boolean {
    const relative = path.relative(directory, filePath);

    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Work out which stage a problematic file should be retried at. Rows flagged
 * before stages were recorded are classified by whether media is linked:
 * identification failures leave the file unlinked.
 * @param file - Problematic file
 * @returns - Stage to retry
 */
async function stageOf(file: File): Promise<ProblemStage> {
    if (file.problemStage === 'identify' || file.problemStage === 'probe') return file.problemStage;

    const linked = await file.countMovies() + await file.countEpisodes();

    return linked > 0 ? 'probe' : 'identify';
}

export type RetryResult =
    | { status: 'queued'; jobs: string[] }
    | { status: 'missing' }
    | { status: 'outside' };

/**
 * Queue the job that re-runs whichever stage failed for a problematic file.
 * The problem flag is left untouched; the job clears it once it succeeds.
 *
 * A file that is gone from disk, usually because it was renamed to fix its
 * identification, is removed instead; the next scan picks up the new name.
 * @param oblecto - Oblecto server instance
 * @param file - Problematic file
 * @returns - `queued` with the job names, `missing` if the file no longer
 * exists and was removed, or `outside` if it is outside every library
 * directory and so cannot be identified
 */
export async function retryProblem(oblecto: ProblemOblecto, file: File): Promise<RetryResult> {
    const filePath = file.path;

    if (filePath === null || filePath === '' || !await exists(filePath)) {
        await file.destroy();

        oblecto.realTimeController?.broadcast('indexer', {
            event: 'problem',
            fileId: file.id,
            problematic: false,
            problemStage: null,
            error: null
        });

        return { status: 'missing' };
    }

    if (await stageOf(file) === 'probe') {
        oblecto.queue.queueJob('indexFileStreams', file);
        oblecto.queue.queueJob('updateFileFFProbe', file);

        return { status: 'queued', jobs: ['indexFileStreams', 'updateFileFFProbe'] };
    }

    const inMovies = (oblecto.config.movies.directories ?? []).some(dir => isInDirectory(dir.path, filePath));

    if (inMovies) {
        oblecto.queue.queueJob('identifyMovieFile', { fileId: file.id });

        return { status: 'queued', jobs: ['identifyMovieFile'] };
    }

    const inSeries = (oblecto.config.tvshows.directories ?? []).some(dir => isInDirectory(dir.path, filePath));

    if (inSeries) {
        oblecto.queue.queueJob('identifyEpisodeFile', { fileId: file.id });

        return { status: 'queued', jobs: ['identifyEpisodeFile'] };
    }

    return { status: 'outside' };
}

async function exists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);

        return true;
    } catch {
        return false;
    }
}
