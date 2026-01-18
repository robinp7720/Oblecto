import binary from 'guessit-exec';
import which from 'which';
import logger from './logger/index.js';

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
    type: 'movie' | 'episode' | string;
    season?: number;
    episode?: number;
    episode_title?: string;
    streaming_service?: string;
}

try {
    which.sync('guessit');
    logger.info( 'Guessit binary has been found');
    logger.info( 'Using local guessit binary');
} catch (e) {
    logger.info( 'Guessit binary has not been found');
    logger.info( 'Please install guessit from your package manager');
    process.exit(1);
}

export default {
    /**
     * @param search - Filename of media entity
     * @returns - Guessit Identification object
     */
    async identify(search: string): Promise<GuessitIdentification> {
        return binary(search);
    }
};
