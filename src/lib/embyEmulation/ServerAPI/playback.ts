import type { Request } from 'express';
import type EmbyEmulation from '../index.js';
import type { PlaybackSession, PlaybackService } from '../../playback/PlaybackService.js';
import type { File } from '../../../models/file.js';
import type { PlaybackOptions } from '../../playback/types.js';
import { PlaybackError } from '../../playback/types.js';
import { getEmbyToken, getRequestValue } from './requestUtils.js';
import { getPlaybackEntry, upsertPlaybackEntry } from './playbackState.js';

export function embyIdentity(
    emby: EmbyEmulation,
    req: Request
): { token: string; owner: string; userId: number } {
    const token = getEmbyToken(req);
    if (!token || !emby.sessions[token])
        throw new PlaybackError('UNAUTHORIZED', 'Authentication required', 401);
    return {
        token,
        owner: `emby:${token}`,
        userId: Number(emby.sessions[token].Id)
    };
}
export function embyOptions(req: Request, file: File): PlaybackOptions {
    const value = (key: string) => getRequestValue(req, key);
    const profile = (value('DeviceProfile') ?? {}) as unknown as {
        DirectPlayProfiles?: {
            Container?: string;
            VideoCodec?: string;
            AudioCodec?: string;
        }[];
        CodecProfiles?: {
            Codec?: string;
            Conditions?: {
                Property: string;
                Condition: string;
                Value: string;
                IsRequired?: boolean;
            }[];
        }[];
        MaxStreamingBitrate?: number;
    };
    const split = (v: unknown): string[] =>
        typeof v === 'string' ? v.toLowerCase().split(',').filter(Boolean) : [];
    const direct = (profile.DirectPlayProfiles ?? []).find(
        (p) =>
            split(p.Container).includes((file.extension ?? '').toLowerCase()) &&
            (!file.videoCodec ||
                split(p.VideoCodec).includes(file.videoCodec)) &&
            (!file.audioCodec || split(p.AudioCodec).includes(file.audioCodec))
    );
    const caps: NonNullable<PlaybackOptions['capabilities']> = {
        containers: direct ? split(direct.Container) : [],
        videoCodecs: direct ? split(direct.VideoCodec) : ['h264'],
        audioCodecs: direct ? split(direct.AudioCodec) : ['aac'],
        hls: true,
        nativeTracks: false,
        hdr: false
    };
    // Honor explicit codec conditions. Unrecognized conditions disable direct play conservatively.
    for (const codec of profile.CodecProfiles ?? []) {
        if (
            !split(codec.Codec).some((name: string) =>
                [file.videoCodec, file.audioCodec].includes(name)
            )
        )
            continue;
        for (const condition of codec.Conditions ?? []) {
            const fields: Record<string, keyof typeof caps> = {
                VideoBitDepth: 'maxBitDepth',
                VideoLevel: 'maxLevel',
                Height: 'maxHeight',
                AudioChannels: 'maxAudioChannels'
            };
            const key = fields[condition.Property];
            if (
                key &&
                ['LessThanEqual', 'Equals'].includes(condition.Condition) &&
                Number(condition.Value) > 0
            ) {
                (caps as Record<string, unknown>)[key] = Number(
                    condition.Value
                );
            } else if (
                condition.Property === 'VideoProfile' &&
                condition.Condition === 'Equals'
            )
                caps.profiles = String(condition.Value).split('|');
            else if (condition.IsRequired !== false) caps.containers = [];
        }
    }
    const number = (key: string): number | undefined =>
        value(key) === undefined ? undefined : Number(value(key));
    const audio = number('AudioStreamIndex');
    const subtitle = number('SubtitleStreamIndex');
    const bitrate =
        number('MaxStreamingBitrate') ?? profile.MaxStreamingBitrate;
    return {
        capabilities: caps,
        position: (number('StartTimeTicks') ?? 0) / 10000000,
        audioStreamIndex: audio === -1 ? null : audio,
        subtitleStreamIndex: subtitle === -1 ? null : subtitle,
        subtitleMode: subtitle === -1 ? 'off' : 'auto',
        ...(bitrate ? { maxBitrate: Number(bitrate) } : {})
    };
}
async function createEmbyPlayback(
    emby: EmbyEmulation,
    req: Request,
    file: File,
    playSessionId: string,
    forceHls = false
) {
    const identity = embyIdentity(emby, req);
    const entry = getPlaybackEntry(emby, identity.token, playSessionId);
    let previous = entry?.streamSessionId
        ? emby.oblecto.playback.sessions.get(String(entry.streamSessionId))
        : undefined;
    if (previous) {
        try {
            emby.oblecto.playback.get(previous.sessionId, identity.owner);
        } catch (error) {
            if (!(error instanceof PlaybackError) || error.code !== 'SESSION_EXPIRED') throw error;
            if (previous.owner === identity.owner) await emby.oblecto.playback.stop(previous);
            previous = undefined;
        }
    }
    const requested = embyOptions(req, file);
    if (
        previous &&
        previous.file.id === file.id &&
        previous.owner === identity.owner
    ) {
        const options: PlaybackOptions = {};
        if (getRequestValue(req, 'AudioStreamIndex') !== undefined)
            options.audioStreamIndex = requested.audioStreamIndex;
        if (getRequestValue(req, 'SubtitleStreamIndex') !== undefined) {
            options.subtitleStreamIndex = requested.subtitleStreamIndex;
            options.subtitleMode = requested.subtitleMode;
        }
        if (getRequestValue(req, 'DeviceProfile') !== undefined) {
            options.capabilities = requested.capabilities;
            options.maxBitrate = requested.maxBitrate;
        }
        if (getRequestValue(req, 'MaxStreamingBitrate') !== undefined)
            options.maxBitrate = requested.maxBitrate;
        if (getRequestValue(req, 'StartTimeTicks') !== undefined)
            options.position = requested.position;
        if (forceHls && previous.plan.method === 'direct')
            options.forceHls = true;
        if (
            Object.entries(options).some(
                ([k, v]) => JSON.stringify(k === 'position' ? previous.position : previous.options[k as keyof PlaybackOptions]) !== JSON.stringify(v)
            )
        ) {
            options.position ??= previous.position;
            await emby.oblecto.playback.update(
                previous,
                options,
                previous.revision
            );
        }
        previous.touch();
        return previous;
    }
    if (previous) await emby.oblecto.playback.stop(previous);
    const s = await emby.oblecto.playback.create(
        file,
        identity.owner,
        identity.userId,
        { ...requested, forceHls }
    );
    upsertPlaybackEntry(emby, identity.token, {
        playSessionId,
        itemId: String(req.params.mediaid ?? req.params.itemid),
        mediaSourceId: file.id,
        streamSessionId: s.sessionId
    });
    return s;
}

const pendingPlayback = new WeakMap<PlaybackService, Map<string, Promise<PlaybackSession>>>();
export function embyPlayback(emby: EmbyEmulation, req: Request, file: File, playSessionId: string, forceHls = false): Promise<PlaybackSession> {
    const identity = embyIdentity(emby, req);
    let pending = pendingPlayback.get(emby.oblecto.playback);
    if (!pending) { pending = new Map(); pendingPlayback.set(emby.oblecto.playback, pending); }
    const key = `${identity.owner}:${playSessionId}`;
    const result = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(() => createEmbyPlayback(emby, req, file, playSessionId, forceHls));
    pending.set(key, result);
    void result.finally(() => { if (pending.get(key) === result) pending.delete(key); }).catch(() => {});
    return result;
}
