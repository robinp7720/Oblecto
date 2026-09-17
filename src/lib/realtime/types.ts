/**
 * Wire types for the realtime remote play protocol.
 *
 * Everything a socket sends is untrusted input, so each inbound shape has a
 * matching validator here rather than a cast at the call site.
 */

export const DEVICE_CAPABILITIES = ['playback', 'control'] as const;
export type DeviceCapability = typeof DEVICE_CAPABILITIES[number];

/**
 * `blocked` is the browser refusing autoplay: the device needs a gesture before
 * it will start. Without it that failure is invisible to the controller, which
 * is exactly the "no feedback" complaint this protocol exists to fix.
 */
export const PLAYBACK_STATUSES = ['idle', 'playing', 'paused', 'buffering', 'blocked', 'error'] as const;
export type PlaybackStatus = typeof PLAYBACK_STATUSES[number];

export const MEDIA_KINDS = ['episode', 'movie'] as const;
export type MediaKind = typeof MEDIA_KINDS[number];

/** Identity a socket declares in its handshake, after the JWT has been verified. */
export type DeviceIdentity = {
    deviceId: string;
    name: string;
    capabilities: DeviceCapability[];
};

export type MediaRef = {
    kind: MediaKind;
    id: string;
    title?: string;
    subtitle?: string;
};

/** What a playing device reports about itself. */
export type PlaybackState = {
    status: PlaybackStatus;
    media: MediaRef | null;
    position: number;
    duration: number;
    volume: number;
    muted: boolean;
    /** A controller hides the controls a target cannot honour, rather than sending commands that quietly do nothing. */
    canSeek: boolean;
    /** False on the browsers that ignore `video.volume` outright, iOS Safari among them. */
    canSetVolume: boolean;
    hasNext: boolean;
    error?: string;
    /**
     * Stamped by the server, never by the reporting device: a controller
     * extrapolates the position from it, and device clocks do not agree.
     */
    updatedAt: number;
};

/** The idle state a device is given before it has reported anything. */
export const IDLE_PLAYBACK_STATE: PlaybackState = {
    status: 'idle',
    media: null,
    position: 0,
    duration: 0,
    volume: 1,
    muted: false,
    canSeek: false,
    canSetVolume: false,
    hasNext: false,
    updatedAt: 0
};

/** A device as it appears to one of its owner's controllers. */
export type DeviceSnapshot = {
    deviceId: string;
    name: string;
    capabilities: DeviceCapability[];
    isSelf: boolean;
    connectedAt: number;
    state: PlaybackState | null;
};

export type RemoteCommand =
    | { type: 'play'; media: MediaRef; position?: number }
    | { type: 'pause' }
    | { type: 'resume' }
    | { type: 'stop' }
    | { type: 'seek'; position: number }
    | { type: 'setVolume'; volume: number }
    | { type: 'setMuted'; muted: boolean }
    | { type: 'next' }
    | { type: 'rename'; name: string };

export type CommandEnvelope = {
    targetDeviceId: string;
    command: RemoteCommand;
};

/** What the target receives, so it can say who is driving it. */
export type DeliveredCommand = {
    from: { deviceId: string; name: string };
    command: RemoteCommand;
};

export const COMMAND_ERROR_CODES = [
    'invalid',
    'unknown_device',
    'unsupported',
    'timeout',
    'failed'
] as const;
export type CommandErrorCode = typeof COMMAND_ERROR_CODES[number];

/**
 * A command is acked `ok` only once the *target* has accepted it, not merely
 * when the server relayed it — the whole point is that the controller learns
 * what actually happened.
 *
 * Note there is no `forbidden` code: a target is resolved inside the caller's
 * own device map, so another user's device is indistinguishable from one that
 * does not exist, and cross-user addressing leaks nothing.
 */
export type CommandAck =
    | { ok: true }
    | { ok: false; code: CommandErrorCode; error: string };

/** How long the server waits for the target to ack before giving up. */
export const COMMAND_TIMEOUT_MS = 5000;

/** Inbound `playback:state` reports above this rate are dropped. */
export const MAX_STATE_REPORTS_PER_SECOND = 10;

export const MAX_DEVICE_NAME_LENGTH = 64;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

/**
 * Trims and bounds a device name. Names are rendered in a menu, so an
 * unbounded string from a client would simply break the layout.
 */
export function normaliseDeviceName(value: unknown, fallback: string): string {
    if (!isNonEmptyString(value)) return fallback;

    return value.trim().slice(0, MAX_DEVICE_NAME_LENGTH);
}

/**
 * Validates the `device` block of a socket handshake.
 * @param value - Raw `socket.handshake.auth.device`.
 * @returns The identity, or null when the handshake is unusable.
 */
export function parseDeviceIdentity(value: unknown): DeviceIdentity | null {
    if (!isRecord(value)) return null;
    if (!isNonEmptyString(value.id)) return null;

    const capabilities = Array.isArray(value.capabilities)
        ? value.capabilities.filter((entry): entry is DeviceCapability =>
            DEVICE_CAPABILITIES.includes(entry as DeviceCapability))
        : [];

    return {
        deviceId: value.id.trim().slice(0, 128),
        name: normaliseDeviceName(value.name, 'Unnamed device'),
        // Every socket can at least control; only a real player claims playback.
        capabilities: capabilities.includes('control') ? capabilities : ['control', ...capabilities]
    };
}

/**
 * Validates a playback state report from a device.
 * @param value - Raw `playback:state` payload.
 * @returns The state with a zeroed `updatedAt` for the caller to stamp, or null.
 */
export function parsePlaybackState(value: unknown): PlaybackState | null {
    if (!isRecord(value)) return null;
    if (!PLAYBACK_STATUSES.includes(value.status as PlaybackStatus)) return null;

    const media = parseMediaRef(value.media);

    if (media === null && value.media !== null && value.media !== undefined) return null;

    const state: PlaybackState = {
        status: value.status as PlaybackStatus,
        media,
        position: isFiniteNumber(value.position) ? Math.max(0, value.position) : 0,
        duration: isFiniteNumber(value.duration) ? Math.max(0, value.duration) : 0,
        volume: isFiniteNumber(value.volume) ? Math.min(1, Math.max(0, value.volume)) : 1,
        muted: value.muted === true,
        canSeek: value.canSeek === true,
        canSetVolume: value.canSetVolume === true,
        hasNext: value.hasNext === true,
        updatedAt: 0
    };

    if (isNonEmptyString(value.error)) state.error = value.error.slice(0, 512);

    return state;
}

function parseMediaRef(value: unknown): MediaRef | null {
    if (!isRecord(value)) return null;
    if (!MEDIA_KINDS.includes(value.kind as MediaKind)) return null;
    if (!isNonEmptyString(value.id)) return null;

    const media: MediaRef = {
        kind: value.kind as MediaKind,
        id: value.id
    };

    if (isNonEmptyString(value.title)) media.title = value.title.slice(0, 256);
    if (isNonEmptyString(value.subtitle)) media.subtitle = value.subtitle.slice(0, 256);

    return media;
}

/**
 * Validates a remote command envelope.
 * @param value - Raw `remote:command` payload.
 * @returns The envelope, or null when it is malformed.
 */
export function parseCommandEnvelope(value: unknown): CommandEnvelope | null {
    if (!isRecord(value)) return null;
    if (!isNonEmptyString(value.targetDeviceId)) return null;

    const command = parseRemoteCommand(value.command);

    if (!command) return null;

    return {
        targetDeviceId: value.targetDeviceId,
        command
    };
}

function parseRemoteCommand(value: unknown): RemoteCommand | null {
    if (!isRecord(value)) return null;

    switch (value.type) {
        case 'pause':
        case 'resume':
        case 'stop':
        case 'next':
            return { type: value.type };

        case 'play': {
            const media = parseMediaRef(value.media);

            if (!media) return null;

            return isFiniteNumber(value.position)
                ? {
                    type: 'play',
                    media,
                    position: Math.max(0, value.position)
                }
                : {
                    type: 'play',
                    media
                };
        }

        case 'seek':
            if (!isFiniteNumber(value.position)) return null;

            return {
                type: 'seek',
                position: Math.max(0, value.position)
            };

        case 'setVolume':
            if (!isFiniteNumber(value.volume)) return null;

            return {
                type: 'setVolume',
                volume: Math.min(1, Math.max(0, value.volume))
            };

        case 'setMuted':
            if (typeof value.muted !== 'boolean') return null;

            return {
                type: 'setMuted',
                muted: value.muted
            };

        case 'rename':
            if (!isNonEmptyString(value.name)) return null;

            return {
                type: 'rename',
                name: normaliseDeviceName(value.name, 'Unnamed device')
            };

        default:
            return null;
    }
}
