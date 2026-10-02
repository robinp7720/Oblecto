type EpisodeLike = { id: number, SeriesId: number | null, airedSeason: unknown, airedEpisodeNumber: unknown };

const number = (value: unknown): number => {
    const parsed = Number(value);
    return value !== '' && value !== null && value !== undefined && Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

/** Order episodes by season, then episode number, numerically; numbers are stored as text. */
export const compareEpisodes = (a: EpisodeLike, b: EpisodeLike): number =>
    number(a.airedSeason) - number(b.airedSeason)
    || number(a.airedEpisodeNumber) - number(b.airedEpisodeNumber)
    || a.id - b.id;

/**
 * Pick the episode to watch next in each series.
 * @param watched - Finished episodes, most recently watched first
 * @param episodes - Every episode of the watched series
 * @returns Ids of the episode after the furthest one watched in each series, ordered by when the series was last watched
 */
export function pickNextEpisodes(watched: EpisodeLike[], episodes: EpisodeLike[]): number[] {
    const furthest = new Map<number, EpisodeLike>();

    for (const episode of watched) {
        if (episode.SeriesId === null) continue;
        const current = furthest.get(episode.SeriesId);
        if (!current || compareEpisodes(episode, current) > 0) furthest.set(episode.SeriesId, episode);
    }

    const sorted = [...episodes].sort(compareEpisodes);
    const next: number[] = [];

    for (const [seriesId, latest] of furthest) {
        const following = sorted.find(episode => episode.SeriesId === seriesId && compareEpisodes(episode, latest) > 0);
        if (following) next.push(following.id);
    }

    return next;
}
