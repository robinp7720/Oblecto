import type { CatalogEpisode, EpisodeCatalog } from '../../models/series.js';

export interface LibraryEpisode {
    id: number;
    tmdbid?: number | null;
    tvdbid?: number | null;
    airedSeason?: string | number | null;
    airedEpisodeNumber?: string | number | null;
    episodeName?: string | null;
    Files?: { id: number }[];
}
export interface EpisodeMatch {
    key: string;
    local: LibraryEpisode | null;
    catalog: CatalogEpisode | null;
    status: 'matched' | 'absent' | 'review' | 'upcoming' | 'unscheduled';
    reason: string;
    special: boolean;
}
const validId = (id: unknown): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0;

/** Numbering is presentation, never identity: providers use different anime/absolute/DVD orders. */
export function matchSeriesEpisodes(local: LibraryEpisode[], catalog: EpisodeCatalog | null, today = new Date().toISOString().slice(0, 10)): EpisodeMatch[] {
    const expected = catalog?.episodes ?? [];
    const localIds = new Map<number, LibraryEpisode[]>();
    const catalogIds = new Map<number, CatalogEpisode[]>();
    for (const row of local) if (validId(row.tmdbid)) localIds.set(row.tmdbid, [...(localIds.get(row.tmdbid) ?? []), row]);
    for (const row of expected) if (validId(row.tmdbid)) catalogIds.set(row.tmdbid, [...(catalogIds.get(row.tmdbid) ?? []), row]);
    const matched = new Set<CatalogEpisode>();
    let unresolved = false;
    const rows: EpisodeMatch[] = local.map(episode => {
        const id = episode.tmdbid;
        const candidates = validId(id) ? catalogIds.get(id) ?? [] : [];
        const match = validId(id) && localIds.get(id)?.length === 1 && candidates.length === 1 ? candidates[0] : null;
        if (match !== null) matched.add(match);
        else unresolved = true;
        const playable = (episode.Files?.length ?? 0) > 0;
        return {
            key: `local-${episode.id}`,
            local: episode,
            catalog: match,
            status: match !== null && playable ? 'matched' : 'review',
            reason: match !== null ? (playable ? 'Exact TMDB episode ID' : 'Matched ID, but no playable file')
                : catalog === null ? 'Catalogue unavailable' : !validId(id) ? 'No TMDB episode ID'
                    : candidates.length > 1 || (localIds.get(id)?.length ?? 0) > 1 ? 'Duplicate episode ID' : 'ID not found in this catalogue',
            special: (episode.airedSeason != null && episode.airedSeason !== '' && Number(episode.airedSeason) === 0) || match?.season === 0
        };
    });
    for (const [index, episode] of expected.entries()) {
        if (matched.has(episode)) continue;
        // An unidentified local file could be any unmatched catalogue entry. Do not claim absence.
        const ambiguous = unresolved || !validId(episode.tmdbid) || catalogIds.get(episode.tmdbid)?.length !== 1;
        const status = ambiguous ? 'review' : episode.airDate === null ? 'unscheduled' : episode.airDate > today ? 'upcoming' : 'absent';
        rows.push({
            key: `catalog-${index}`,
            local: null,
            catalog: episode,
            status,
            reason: ambiguous ? 'Resolve unmatched library episodes or duplicate IDs before checking absence'
                : status === 'absent' ? 'No library episode with this TMDB ID'
                    : status === 'upcoming' ? 'Future air date in TMDB' : 'No air date in TMDB',
            special: episode.season === 0
        });
    }
    return rows.sort((a, b) => Number(a.local?.airedSeason ?? a.catalog?.season ?? Infinity) - Number(b.local?.airedSeason ?? b.catalog?.season ?? Infinity)
        || Number(a.local?.airedEpisodeNumber ?? a.catalog?.number ?? Infinity) - Number(b.local?.airedEpisodeNumber ?? b.catalog?.number ?? Infinity));
}
