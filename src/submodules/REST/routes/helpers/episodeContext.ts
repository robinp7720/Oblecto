type EpisodeLike = Record<string, unknown>;

const number = (value: unknown): number | null => {
    const parsed = Number(value);
    return value !== '' && value !== null && value !== undefined && Number.isFinite(parsed) ? parsed : null;
};

const seasonKey = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? String(value) : 'unknown';

const progress = (episode: EpisodeLike): number => {
    const tracks: unknown[] = Array.isArray(episode.TrackEpisodes) ? episode.TrackEpisodes as unknown[] : [];
    const first: unknown = tracks[0];
    const value = first !== null && typeof first === 'object' ? (first as Record<string, unknown>).progress : 0;
    return Number(value) || 0;
};

/** Build navigation and season facts from one series' user-scoped episode rows. */
export function buildEpisodeContext(episodes: EpisodeLike[], currentId: number): Record<string, unknown> | null {
    const current = episodes.find(episode => Number(episode.id) === Number(currentId));
    if (!current) return null;

    const currentSeason = number(current.airedSeason);
    const regular = currentSeason !== null && currentSeason > 0;
    const sequence = episodes.filter(episode => {
        const season = number(episode.airedSeason);
        return regular ? season !== null && season > 0 : seasonKey(episode.airedSeason) === seasonKey(current.airedSeason);
    }).sort((a, b) =>
        (number(a.airedSeason) ?? Number.MAX_SAFE_INTEGER) - (number(b.airedSeason) ?? Number.MAX_SAFE_INTEGER)
        || (number(a.airedEpisodeNumber) ?? Number.MAX_SAFE_INTEGER) - (number(b.airedEpisodeNumber) ?? Number.MAX_SAFE_INTEGER)
        || Number(a.id) - Number(b.id));
    const index = sequence.findIndex(episode => Number(episode.id) === Number(currentId));
    const seasonEpisodes = sequence.filter(episode => seasonKey(episode.airedSeason) === seasonKey(current.airedSeason));
    const ratings = seasonEpisodes.map(episode => Number(episode.siteRating)).filter(value => Number.isFinite(value) && value > 0);
    const runtimeMinutes = seasonEpisodes.reduce((total, episode) => total + (number(episode.runtime) ?? 0), 0);
    const seasonPosition = seasonEpisodes.findIndex(episode => Number(episode.id) === Number(currentId));

    return {
        previous: index > 0 ? sequence[index - 1] : null,
        next: index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null,
        season: {
            number: current.airedSeason ?? null,
            position: seasonPosition >= 0 ? seasonPosition + 1 : null,
            episodeCount: seasonEpisodes.length,
            watchedCount: seasonEpisodes.filter(episode => progress(episode) >= 0.9).length,
            runtimeMinutes,
            averageRating: ratings.length ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10 : null
        }
    };
}
