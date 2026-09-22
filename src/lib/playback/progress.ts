import type { Model } from 'sequelize';
import { EventEmitter } from 'node:events';
import { TrackMovie } from '../../models/trackMovie.js';
import { TrackEpisode } from '../../models/trackEpisode.js';

export type ProgressChange = {
    type: 'movie' | 'episode';
    id: number;
    track: { time: number; progress: number; updatedAt: string };
};
/** Emitted only after a successful database write; the realtime controller scopes delivery by user. */
export const progressEvents = new EventEmitter();
/** Serialize writes for each viewer/item so slower database writes cannot restore stale positions. */
const pending = new Map<string, Promise<void>>();
export async function saveProgress(
    userId: number,
    type: 'movie' | 'episode',
    itemId: number,
    time: number,
    duration: number
): Promise<void> {
    await writeProgress(userId, type, itemId, {
        time,
        progress: duration > 0 ? Math.min(1, time / duration) : 0
    });
}

/** Mark an item watched, or back to unwatched, as "mark played" in a Jellyfin app does. */
export async function setPlayed(userId: number, type: 'movie' | 'episode', itemId: number, played: boolean): Promise<void> {
    await writeProgress(userId, type, itemId, { time: 0, progress: played ? 1 : 0 });
}

async function writeProgress(
    userId: number,
    type: 'movie' | 'episode',
    itemId: number,
    values: { time: number; progress: number }
): Promise<void> {
    const key = `${userId}:${type}:${itemId}`;
    const save = async (): Promise<void> => {
        const [track, created] =
            type === 'movie'
                ? await TrackMovie.findOrCreate({
                      where: { userId, movieId: itemId },
                      defaults: {
                          ...values,
                          userId,
                          movieId: itemId
                      }
                  })
                : await TrackEpisode.findOrCreate({
                      where: { userId, episodeId: itemId },
                      defaults: {
                          ...values,
                          userId,
                          episodeId: itemId
                      }
                  });
        if (!created) await (track as Model).update(values);
        progressEvents.emit('saved', userId, {
            type, id: itemId, track: { ...values, updatedAt: track.updatedAt.toISOString() }
        } satisfies ProgressChange);
    };
    const promise = (pending.get(key) ?? Promise.resolve())
        .catch(() => {})
        .then(save);
    pending.set(key, promise);
    try {
        await promise;
    } finally {
        if (pending.get(key) === promise) pending.delete(key);
    }
}
