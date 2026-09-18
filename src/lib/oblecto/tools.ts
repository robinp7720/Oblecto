import which from 'which';
import type { IConfig } from '../../interfaces/config.js';

export type ToolReport = {
    guessit: boolean;
    ffmpeg: boolean;
    ffprobe: boolean;
};

const found = (binary: string): boolean => which.sync(binary, { nothrow: true }) !== null;

/** Which external programs Oblecto can run: guessit for identification, ffmpeg and ffprobe for playback. */
export function probeTools(config: IConfig): ToolReport {
    return {
        guessit: found('guessit'),
        ffmpeg: found(config.ffmpeg.pathFFmpeg || 'ffmpeg'),
        ffprobe: found(config.ffmpeg.pathFFprobe || 'ffprobe')
    };
}

/** What stops working without each missing program, for the startup log. */
export function describeMissingTools(report: ToolReport): string[] {
    const problems: string[] = [];

    if (!report.guessit) problems.push('guessit was not found, so new files cannot be identified. Install it with your package manager (python3-guessit) or pip.');
    if (!report.ffprobe) problems.push('ffprobe was not found, so files cannot be inspected for playback. Install ffmpeg or set ffmpeg.pathFFprobe.');
    if (!report.ffmpeg) problems.push('ffmpeg was not found, so media that needs converting cannot play. Install ffmpeg or set ffmpeg.pathFFmpeg.');

    return problems;
}
