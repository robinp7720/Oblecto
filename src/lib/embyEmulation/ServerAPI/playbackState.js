const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

const ensurePlaybackState = (session) => {
    if (!session.playbackState) {
        session.playbackState = {
            playSessions: new Map(),
            lastMediaSourceByItem: new Map()
        };
    }
    return session.playbackState;
};

const prunePlaySessions = (playbackState, now) => {
    for (const [id, entry] of playbackState.playSessions.entries()) {
        if (now - entry.updatedAt > DEFAULT_TTL_MS) {
            playbackState.playSessions.delete(id);
        }
    }
};

export const getPlaybackState = (embyEmulation, token) => {
    if (!token) return null;
    const session = embyEmulation.sessions?.[token];
    if (!session) return null;
    return ensurePlaybackState(session);
};

export const getPlaybackEntry = (embyEmulation, token, playSessionId) => {
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

export const upsertPlaybackEntry = (embyEmulation, token, entry) => {
    if (!entry?.playSessionId) return null;
    const playbackState = getPlaybackState(embyEmulation, token);
    if (!playbackState) return null;
    const now = Date.now();
    prunePlaySessions(playbackState, now);
    const existing = playbackState.playSessions.get(entry.playSessionId) || { playSessionId: entry.playSessionId };
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

export const setLastMediaSource = (embyEmulation, token, itemId, mediaSourceId) => {
    if (!itemId || mediaSourceId === undefined || mediaSourceId === null) return;
    const playbackState = getPlaybackState(embyEmulation, token);
    if (!playbackState) return;
    playbackState.lastMediaSourceByItem.set(itemId, mediaSourceId);
};

export const getLastMediaSource = (embyEmulation, token, itemId) => {
    const playbackState = getPlaybackState(embyEmulation, token);
    if (!playbackState || !itemId) return null;
    return playbackState.lastMediaSourceByItem.get(itemId) || null;
};

export const deletePlaybackEntry = (embyEmulation, token, playSessionId) => {
    const playbackState = getPlaybackState(embyEmulation, token);
    if (!playbackState || !playSessionId) return false;
    return playbackState.playSessions.delete(playSessionId);
};
