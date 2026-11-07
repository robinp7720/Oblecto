import type { IConfig } from '../../interfaces/config.js';
import type { PlaybackSession } from './PlaybackService.js';
import type { SegmentCache } from './cache.js';
import { run } from './process.js';
import { trackOperations } from './planner.js';

export interface EncoderDependencies {
    cache: Pick<SegmentCache, 'acquire'>;
    ffmpeg(): string;
    transcoding(): Pick<IConfig['transcoding'], 'hardwareAcceleration' | 'hardwareAccelerator'>;
    vaapiDevice(): string | undefined;
    run?: typeof run;
}

/** Generates segments and owns hardware detection/fallback; session lifetime stays with the caller. */
export class SegmentEncoder {
    private hardware?: Promise<string | null>;
    private readonly run: typeof run;
    constructor(private readonly dependencies: EncoderDependencies) {
        this.run = dependencies.run ?? run;
    }
    private get ffmpeg(): string { return this.dependencies.ffmpeg(); }
    private async encoder(): Promise<string | null> {
        this.hardware ??= (async () => {
            if (!this.dependencies.transcoding()?.hardwareAcceleration)
                return null;
            const type = this.dependencies.transcoding().hardwareAccelerator;
            const candidate =
                type === 'cuda'
                    ? 'h264_nvenc'
                    : type === 'vaapi'
                      ? 'h264_vaapi'
                      : null;
            if (!candidate) return null;
            const available = await this.run(this.ffmpeg, [
                '-hide_banner',
                '-encoders'
            ]).catch(() => '');
            return available.includes(candidate) ? candidate : null;
        })();
        return this.hardware;
    }
    async segment(
        s: PlaybackSession,
        rendition: string,
        index: number,
        output: string,
        endIndex = index + 1,
        signal = s.signal.signal,
        window = false
    ): Promise<void> {
        const plan = s.plan;
        const start = plan.boundaries[index];
        const length = plan.boundaries[endIndex] - start;
        const outputArgs = window
            ? ['-f', 'hls', '-hls_time', '2', '-hls_playlist_type', 'vod', '-hls_flags', 'temp_file', '-start_number', String(index), '-hls_segment_filename', `${output}/%d.ts`, `${output}/index.m3u8`]
            : ['-f', 'mpegts', output];
        const quality = plan.renditions.find((r) => r.id === rendition)!;
        const args = [
            '-hide_banner',
            '-loglevel',
            'error',
            '-nostdin',
            '-y',
            '-ss',
            String(start),
            '-i',
            s.media.path,
            '-t',
            String(length)
        ];
        if (plan.video) args.push('-map', `0:${plan.video.index}`);
        else args.push('-vn');
        if (plan.audio) args.push('-map', `0:${plan.audio.index}`);
        else args.push('-an');
        args.push('-sn');
        const encode = async (hardware: string | null) => {
            const command = [...args];
            if (trackOperations(s.plan).video !== 'encode') {
                if (plan.video) command.push('-c:v', 'copy');
                if (plan.audio) command.push('-c:a', trackOperations(s.plan).audio === 'copy' ? 'copy' : 'aac');
                if (trackOperations(s.plan).audio === 'encode') command.push('-b:a', '128k', '-ac', '2', '-ar', '48000');
            }
            else {
                if (plan.video) {
                    const filters: string[] = [];
                    if (plan.hdr)
                        filters.push(
                            'zscale=t=linear:npl=100',
                            'format=gbrpf32le',
                            'zscale=p=bt709',
                            'tonemap=tonemap=hable:desat=0',
                            'zscale=t=bt709:m=bt709:r=tv'
                        );
                    if (plan.burnSubtitles && plan.subtitle) {
                        if (
                            ['ass', 'ssa'].includes(
                                plan.subtitle.codec_name ?? ''
                            )
                        ) {
                            // Use a safe generated filename rather than interpolating source paths into filter expressions.
                            const lease = await this.dependencies.cache.acquire(
                                `${s.sessionId}/${s.revision}/ass`,
                                async (file) => {
                                    await this.run(
                                        this.ffmpeg,
                                        [
                                            '-v',
                                            'error',
                                            '-y',
                                            '-i',
                                            s.media.path,
                                            '-map',
                                            `0:${plan.subtitle!.index}`,
                                            '-c:s',
                                            'ass',
                                            '-f',
                                            'ass',
                                            file
                                        ],
                                        signal
                                    );
                                }
                            );
                            try {
                                filters.push(
                                    `setpts=PTS+${start}/TB`,
                                    `ass=filename='${lease.path}'`,
                                    `setpts=PTS-STARTPTS`
                                );
                                await this.encodeVideo(
                                    s,
                                    command,
                                    filters,
                                    quality,
                                    hardware,
                                    start,
                                    outputArgs,
                                    signal
                                );
                            } finally {
                                lease.release();
                            }
                            return;
                        }
                        // Bitmap subtitles are decoded alongside video and composited before scaling.
                        command.splice(
                            command.indexOf('-t'),
                            0,
                            '-i',
                            s.media.path
                        );
                        command.push(
                            '-filter_complex',
                            `[0:${plan.video.index}]setpts=PTS+${start}/TB[base];[1:${plan.subtitle.index}]scale=${plan.video.width}:${plan.video.height}[sub];[base][sub]overlay=eof_action=pass,setpts=PTS-STARTPTS[vsub]`,
                            '-map',
                            '-0:v',
                            '-map',
                            '[vsub]'
                        );
                    }
                    await this.encodeVideo(
                        s,
                        command,
                        filters,
                        quality,
                        hardware,
                        start,
                        outputArgs,
                        signal
                    );
                    return;
                }
                if (plan.audio)
                    command.push(
                        '-c:a',
                        'aac',
                        '-b:a',
                        '128k',
                        '-ac',
                        '2',
                        '-ar',
                        '48000'
                    );
            }
            command.push(
                '-output_ts_offset',
                String(start),
                '-muxdelay',
                '0',
                '-muxpreload',
                '0',
                ...outputArgs
            );
            await this.run(this.ffmpeg, command, signal, 60000);
        };
        const begun = Date.now();
        const hardware =
            trackOperations(s.plan).video === 'encode' ? await this.encoder() : null;
        try {
            await encode(hardware);
        } catch (error) {
            if (!hardware || signal.aborted) throw error;
            this.hardware = Promise.resolve(null);
            await encode(null);
        }
        s.delivery.generationMs = Date.now() - begun;
        s.encodingSpeed = length / Math.max(0.001, (Date.now() - begun) / 1000);
    }
    private async encodeVideo(
        s: PlaybackSession,
        command: string[],
        filters: string[],
        quality: { height: number; bitrate: number },
        hardware: string | null,
        start: number,
        outputArgs: string[],
        signal: AbortSignal
    ): Promise<void> {
        filters.push(
            `scale=w=-2:h='min(${quality.height},ih)'`,
            'fps=30',
            'format=yuv420p'
        );
        if (hardware === 'h264_vaapi') {
            command.unshift(
                '-vaapi_device',
                this.dependencies.vaapiDevice() ??
                    '/dev/dri/renderD128'
            );
            filters.push('format=nv12', 'hwupload');
        }
        if (command.includes('-filter_complex')) {
            const i = command.indexOf('-filter_complex');
            command[i + 1] = command[i + 1].replace(
                '[vsub]',
                `[overlay];[overlay]${filters.join(',')}[vsub]`
            );
        } else command.push('-vf', filters.join(','));
        if (s.plan.hdr) command.push('-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709');
        command.push('-c:v', hardware ?? 'libx264');
        if (!hardware)
            command.push(
                '-preset',
                'veryfast',
                '-threads',
                '2',
                '-sc_threshold',
                '0'
            );
        command.push(
            '-profile:v', 'main', '-level:v', '4.0',
            '-b:v',
            String(quality.bitrate),
            '-maxrate',
            String(quality.bitrate),
            '-bufsize',
            String(quality.bitrate * 2),
            '-g',
            '60',
            '-keyint_min',
            '60',
            '-force_key_frames',
            'expr:gte(t,n_forced*2)',
            '-pix_fmt',
            hardware === 'h264_vaapi' ? 'vaapi' : 'yuv420p'
        );
        if (s.plan.audio)
            command.push(
                '-c:a',
                'aac',
                '-b:a',
                '128k',
                '-ac',
                '2',
                '-ar',
                '48000'
            );
        command.push(
            '-output_ts_offset',
            String(start),
            '-muxdelay',
            '0',
            '-muxpreload',
            '0',
            ...outputArgs
        );
        await this.run(this.ffmpeg, command, signal, 60000);
    }
}
