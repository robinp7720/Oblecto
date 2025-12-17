import web from 'guessit-wrapper';
import binary from 'guessit-exec';
import which from 'which';

import logger from './logger';

/**
 * @typedef {object} GuessitIdentification
 * @property {string} title - Entity title
 * @property {number} year - Year item was released
 * @property {string} screen_size - Item resolution
 * @property {string} source - Origin of media
 * @property {string} video_codec - Video codec
 * @property {string} video_profile - Video profile
 * @property {string} audio_profile - Audio profile
 * @property {string} audio_channels - Audio channels
 * @property {string} release_group - Name of release group
 * @property {string} container - Container format used
 * @property {string} mimetype - Mimetype
 * @property {string} type - Type of media
 * @property {number} season - Season number if type is episode
 * @property {number} episode - Episode number if type is episode
 * @property {string} episode_title - Episode title if type is episode
 * @property {string} streaming_service - Streaming service origin
 */

which('guessit', function (err, resolvedPath) {
    if (err) {
        logger.log('INFO', 'Guessit binary has not been found');
        logger.log('INFO', 'Please install guessit from your package manager');
        process.exit(1);
    }

    logger.log('INFO', 'Guessit binary has been found');
    logger.log('INFO', 'Using local guessit binary');
});

export default {
    /**
     * @param {string} search - Filename of media entity
     *
     * @returns {GuessitIdentification} - Guessit Identification object
     */
    async identify(search) {
        return binary(search);
    }
};
