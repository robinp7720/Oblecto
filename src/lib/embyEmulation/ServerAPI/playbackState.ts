type PlaybackEntry = {
    playSessionId: string;
    itemId?: string | number;
    mediaSourceId?: string | number;
    streamSessionId?: string | number;
    updatedAt: number;
};

type PlaybackState = {
    playSessions: Map<string, PlaybackEntry>;
    lastMediaSourceByItem: Map<string | number, string | number>;
};

type EmbySession = {
    playbackState?: PlaybackState;
};

type EmbyEmulationLike = {
    sessions?: Record<string, EmbySession>;
};

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

const ensurePlaybackState = (session: EmbySession): PlaybackState => {
    if (!session.playbackState) {
        session.playbackState = {
            playSessions: new Map(),
            lastMediaSourceByItem: new Map()
        };
    }
    return session.playbackState;
};

const prunePlaySessions = (playbackState: PlaybackState, now: number): void => {
    for (const [id, entry] of playbackState.playSessions.entries()) {
        if (now - entry.updatedAt > DEFAULT_TTL_MS) {
            playbackState.playSessions.delete(id);
        }
    }
};

export const getPlaybackState = (embyEmulation: EmbyEmulationLike, token?: string): PlaybackState | null => {
    if (!token) return null;
    const session = embyEmulation.sessions?.[token];

    if (!session) return null;
    return ensurePlaybackState(session);
};

export const getPlaybackEntry = (embyEmulation: EmbyEmulationLike, token: string, playSessionId?: string): PlaybackEntry | null => {
    const playbackState = getPlaybackState(embyEmulation, token);

    if (!playbackState || !playSessionId) return null;
    const now = Date.now();

    prunePlaySessions(playbackState, now);
    const entry = playbackState.playSessions.get(playSessionId);

    if (!entry) return null;
    if (now - entry.updatedAt > DEFAULT_TTL_MS) {
        playbackState.playSessions.delete(playSessionId);
        return null;
    }
    return entry;
};

export const upsertPlaybackEntry = (embyEmulation: EmbyEmulationLike, token: string, entry: Partial<PlaybackEntry> & { playSessionId?: string }): PlaybackEntry | null => {
    if (!entry?.playSessionId) return null;
    const playbackState = getPlaybackState(embyEmulation, token);

    if (!playbackState) return null;
    const now = Date.now();

    prunePlaySessions(playbackState, now);
    const existing = playbackState.playSessions.get(entry.playSessionId) || { playSessionId: entry.playSessionId, updatedAt: now };
    const next = {
        ...existing,
        itemId: entry.itemId ?? existing.itemId,
        mediaSourceId: entry.mediaSourceId ?? existing.mediaSourceId,
        streamSessionId: entry.streamSessionId ?? existing.streamSessionId,
        updatedAt: now
    };

    playbackState.playSessions.set(entry.playSessionId, next);
    return next;
};

export const setLastMediaSource = (embyEmulation: EmbyEmulationLike, token: string, itemId?: string | number, mediaSourceId?: string | number): void => {
    if (!itemId || mediaSourceId === undefined || mediaSourceId === null) return;
    const playbackState = getPlaybackState(embyEmulation, token);

    if (!playbackState) return;
    playbackState.lastMediaSourceByItem.set(itemId, mediaSourceId);
};

export const getLastMediaSource = (embyEmulation: EmbyEmulationLike, token: string, itemId?: string | number): string | number | null => {
    const playbackState = getPlaybackState(embyEmulation, token);

    if (!playbackState || !itemId) return null;
    return playbackState.lastMediaSourceByItem.get(itemId) || null;
};

export const deletePlaybackEntry = (embyEmulation: EmbyEmulationLike, token: string, playSessionId?: string): boolean => {
    const playbackState = getPlaybackState(embyEmulation, token);

    if (!playbackState || !playSessionId) return false;
    return playbackState.playSessions.delete(playSessionId);
};
