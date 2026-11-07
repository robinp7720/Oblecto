import type Queue from '../../src/lib/queue/index.js';
import type { File } from '../../src/models/file.js';
import type { Movie } from '../../src/models/movie.js';

// Compiled, never executed. These assertions protect the producer/handler contract.
export function queueContracts(queue: Queue, movie: Movie, file: File): void {
    queue.queueJob('updateMovie', movie);
    queue.pushJob('rescaleImage', { from: 'a', to: 'b', width: 200 });
    // @ts-expect-error Unknown job names cannot be queued.
    queue.queueJob('missingJob', null);
    // @ts-expect-error File data is not a movie-update payload.
    queue.queueJob('updateMovie', file);
    // @ts-expect-error Handlers must accept the registered job's payload.
    queue.registerJob('updateMovie', async (_file: File) => {});
    // @ts-expect-error Required payload fields cannot be omitted.
    queue.pushJob('indexMovie', {});
    const name = Math.random() ? 'updateMovie' : 'updateFile';
    // @ts-expect-error A union job name must retain its corresponding payload.
    queue.queueJob(name, movie);
}
