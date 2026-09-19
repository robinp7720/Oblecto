import binary from 'guessit-exec';
import which from 'which';
import IdentificationError from '../lib/errors/IdentificationError.js';

export interface GuessitIdentification {
    title: string;
    year?: number;
    screen_size?: string;
    source?: string;
    video_codec?: string;
    video_profile?: string;
    audio_profile?: string;
    audio_channels?: string;
    release_group?: string;
    container?: string;
    mimetype?: string;
    type: 'movie' | 'episode' | (string & {});
    season?: number;
    episode?: number;
    episode_title?: string;
    streaming_service?: string;
}

let available: boolean | undefined;

/** Whether the guessit program is on the PATH. Checked once, when first needed. */
export const guessitAvailable = (): boolean => (available ??= which.sync('guessit', { nothrow: true }) !== null);

export default {
    /**
     * @param search - Filename of media entity
     * @returns - Guessit Identification object
     */
    identify(search: string): Promise<GuessitIdentification> {
        // Without guessit nothing can be identified; say so per file rather than stopping the server.
        if (!guessitAvailable()) return Promise.reject(new IdentificationError('guessit is not installed'));

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return binary(search) as Promise<GuessitIdentification>;
    }
};
