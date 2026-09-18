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
