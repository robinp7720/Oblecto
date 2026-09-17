import { invalid, PlaybackError } from './types.js';
import type { Media, PlaybackOptions, PlaybackPlan, Track } from './types.js';
export const LADDER = [
    {
        id: '360',
        height: 360,
        bitrate: 800000
    },
    {
        id: '480',
        height: 480,
        bitrate: 1400000
    },
    {
        id: '720',
        height: 720,
        bitrate: 2800000
    },
    {
        id: '1080',
        height: 1080,
        bitrate: 5000000
    }
];
export function planPlayback(
    media: Media,
    options: PlaybackOptions,
    language = 'eng'
): PlaybackPlan {
    const c = options.capabilities ?? {};
    const video =
        media.streams.find(
            (t) => t.codec_type === 'video' && !t.disposition?.attached_pic
        ) ?? null;
    const audios = media.streams.filter((t) => t.codec_type === 'audio');
    const subtitles = media.streams.filter((t) => t.codec_type === 'subtitle');
    if (!video && audios.length === 0) throw new PlaybackError('UNSUPPORTED_MEDIA', 'No playable audio or video streams', 422);
    const select = (
        tracks: Track[],
        index: number | null | undefined
    ): Track | null => {
        if (index === null) return null;
        if (index !== undefined)
            return (
                tracks.find((t) => t.index === index) ??
                invalid('Track does not exist')
            );
        return (
            tracks.find(
                (t) => t.tags?.language === language && t.disposition?.default
            ) ??
            tracks.find((t) => t.tags?.language === language) ??
            tracks.find((t) => t.disposition?.default) ??
            tracks[0] ??
            null
        );
    };
    const audio = select(audios, options.audioStreamIndex);
    const candidates = subtitles.filter(
        (t) =>
            t.disposition?.forced ||
            (options.subtitleMode !== 'forced' && t.disposition?.default)
    );
    const subtitle =
        options.subtitleMode === 'off'
            ? null
            : options.subtitleStreamIndex !== undefined
              ? select(subtitles, options.subtitleStreamIndex)
              : select(candidates, undefined);
    const burnSubtitles =
        !!subtitle &&
        !['subrip', 'webvtt', 'mov_text', 'text'].includes(
            subtitle.codec_name ?? ''
        );
    const hdr = ['smpte2084', 'arib-std-b67'].includes(
        video?.color_transfer ?? ''
    );
    const depthMatch = /(?:p0?|gray)(10|12|16)/.exec(video?.pix_fmt ?? '');
    const bitDepth = depthMatch ? Number(depthMatch[1]) : 8;
    const videoOK =
        !video ||
        ((c.videoCodecs ?? ['h264']).includes(video.codec_name ?? '') &&
            (c.maxBitDepth ?? 8) >= bitDepth &&
            (!hdr || c.hdr === true) &&
            (!video.level || video.level <= (c.maxLevel ?? 42)) &&
            (!video.height || video.height <= (c.maxHeight ?? 1080)) &&
            (!video.profile ||
                (
                    c.profiles ?? [
                        'Baseline',
                        'Constrained Baseline',
                        'Main',
                        'High'
                    ]
                ).includes(video.profile)));
    const audioOK =
        !audio ||
        ((c.audioCodecs ?? ['aac']).includes(audio.codec_name ?? '') &&
            (audio.channels ?? 2) <= (c.maxAudioChannels ?? 2));
    const tracksOK =
        c.nativeTracks === true ||
        ((!audio || audio.index === audios[0]?.index) &&
            !(options.audioStreamIndex === null && audios.length));
    const adaptive =
        options.quality === 'auto' ||
        typeof options.quality === 'number' ||
        options.maxBitrate !== undefined;
    const direct =
        videoOK &&
        audioOK &&
        tracksOK &&
        !burnSubtitles &&
        !adaptive &&
        !options.forceHls &&
        (c.containers ?? ['mp4', 'm4v']).includes(media.container);
    const method = direct
        ? 'direct'
        : videoOK &&
            audioOK &&
            !burnSubtitles &&
            !adaptive &&
            (!video || video.codec_name === 'h264')
          ? 'remux'
          : 'transcode';
    if (method !== 'direct' && c.hls === false)
        throw new PlaybackError(
            'UNSUPPORTED_MEDIA',
            'This client cannot play the required HLS output',
            422
        );
    const height = Math.min(video?.height ?? 360, c.maxHeight ?? 1080);
    let renditions = LADDER.filter(
        (r) =>
            r.height <= height &&
            (options.maxBitrate === undefined ||
                r.bitrate + 128000 <= options.maxBitrate)
    );
    if (!renditions.length)
        renditions = [
            {
                id: 'low',
                height: Math.max(2, Math.floor(height / 2) * 2),
                bitrate: Math.min(
                    800000,
                    (options.maxBitrate ?? 928000) - 128000
                )
            }
        ];
    if (typeof options.quality === 'number')
        renditions = [
            renditions
                .filter((r) => r.height <= (options.quality as number))
                .at(-1) ?? renditions[0]
        ];
    if (method !== 'transcode')
        renditions = [
            {
                id: 'source',
                height: video?.height ?? 0,
                bitrate: Math.ceil((media.size * 8) / media.duration)
            }
        ];
    const boundaries: number[] = [];
    for (let time = 0; time < media.duration; time += 4) boundaries.push(time);
    boundaries.push(media.duration);
    return {
        method,
        reason: direct
            ? 'Original is compatible'
            : burnSubtitles
              ? 'Subtitle rendering required'
              : adaptive
                ? 'Adaptive quality requested'
                : method === 'remux'
                  ? 'Container or track selection requires remuxing'
                  : 'Source exceeds client capabilities',
        audio,
        video,
        subtitle,
        burnSubtitles,
        hdr,
        renditions,
        boundaries
    };
}
