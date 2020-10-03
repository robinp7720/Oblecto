import web from 'guessit-wrapper';
import binary from 'guessit-exec';
import which from 'which';

import logger from './logger';

let use_binary = false;

which('guessit', function (err, resolvedPath) {
    if (err) {
        logger.log('INFO', 'Guessit binary has not been found');
        logger.log('INFO', 'Using the web based identifier');
        logger.log('INFO', 'This may significantly reduce indexing speeds');
        logger.log('INFO', 'Please install guessit from you package manager');

        return;
    }

    logger.log('INFO', 'Guessit binary has been found');
    logger.log('INFO', 'Using local guessit binary');

    use_binary = true;
});

export default {
    async identify(search) {
        if (use_binary) {
            return binary(search);
        }

        return web.parseName(search);
    }
};
