import { Op, type Sequelize } from 'sequelize';
import { Episode } from '../../models/episode.js';
import { TrackEpisode } from '../../models/trackEpisode.js';
import { TrackMovie } from '../../models/trackMovie.js';
import { WATCHED_PROGRESS } from '../playback/progress.js';

type ProgressState = 'finished' | 'inprogress' | 'started';
export type ItemWatchState = ProgressState | 'unfinished' | 'unstarted';

export function progressWhere(state: ProgressState): { progress: { [Op.gte]?: number; [Op.gt]?: number; [Op.lt]?: number } } {
    if (state === 'finished') return { progress: { [Op.gte]: WATCHED_PROGRESS } };
    if (state === 'inprogress') return { progress: { [Op.gt]: 0, [Op.lt]: WATCHED_PROGRESS } };
    return { progress: { [Op.gt]: 0 } };
}

/** The caller supplies a quoted column, never request text. */
function progressSql(column: string, state: ProgressState): string {
    if (state === 'finished') return `${column} >= ${WATCHED_PROGRESS}`;
    if (state === 'inprogress') return `${column} > 0 AND ${column} < ${WATCHED_PROGRESS}`;
    return `${column} > 0`;
}

/**
 * Per-viewer predicates shared by native browsing and Jellyfin. Native series browsing uses
 * any finished episode; Jellyfin's finished-series filter requires every episode to be finished.
 * Unstarted (no progress) is distinct from unfinished (below the completion threshold).
 */
export function itemWatchCondition(
    database: Sequelize,
    kind: 'movie' | 'series' | 'episode',
    userId: number,
    state: ItemWatchState,
    seriesCompletion: 'any' | 'all' = 'all'
): string {
    const generator = database.getQueryInterface().queryGenerator as { quoteIdentifier(name: string): string };
    const q = (name: string): string => generator.quoteIdentifier(name);
    const user = database.escape(userId);
    const progress = (value: ProgressState): string => progressSql(`${q('t')}.${q('progress')}`, value);
    const positiveState = state === 'unstarted' ? 'started' : state === 'unfinished' ? 'finished' : state;

    if (kind === 'series') {
        const episodes = q(Episode.getTableName() as string);
        const tracks = q(TrackEpisode.getTableName() as string);
        const ofSeries = `${q('e')}.${q('SeriesId')} = ${q('Series')}.${q('id')}`;
        const track = (value: ProgressState): string => `EXISTS (SELECT 1 FROM ${tracks} ${q('t')} WHERE ${q('t')}.${q('episodeId')} = ${q('e')}.${q('id')} AND ${q('t')}.${q('userId')} = ${user} AND ${progress(value)})`;
        const unfinished = `EXISTS (SELECT 1 FROM ${episodes} ${q('e')} WHERE ${ofSeries} AND NOT ${track('finished')})`;
        if (state === 'unfinished') return unfinished;
        if (state === 'finished' && seriesCompletion === 'all')
            return `(EXISTS (SELECT 1 FROM ${episodes} ${q('e')} WHERE ${ofSeries}) AND NOT ${unfinished})`;
        const any = `EXISTS (SELECT 1 FROM ${episodes} ${q('e')} WHERE ${ofSeries} AND ${track(positiveState)})`;
        return state === 'unstarted' ? `NOT ${any}` : any;
    }

    const movie = kind === 'movie';
    const table = q((movie ? TrackMovie : TrackEpisode).getTableName() as string);
    const key = q(movie ? 'movieId' : 'episodeId');
    const item = `${q(movie ? 'Movie' : 'Episode')}.${q('id')}`;
    const exists = `EXISTS (SELECT 1 FROM ${table} ${q('t')} WHERE ${q('t')}.${key} = ${item} AND ${q('t')}.${q('userId')} = ${user} AND ${progress(positiveState)})`;
    return state === 'unfinished' || state === 'unstarted' ? `NOT ${exists}` : exists;
}
