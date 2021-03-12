import web from 'guessit-wrapper';
import binary from 'guessit-exec';
import which from 'which';

import logger from './logger';

let useBinary = false;

which('guessit', function (err, resolvedPath) {
    if (err) {
        logger.log('INFO', 'Guessit binary has not been found');
        logger.log('INFO', 'Using the web based identifier');
        logger.log('INFO', 'This may significantly reduce indexing speeds');
        logger.log('INFO', 'Please install guessit from your package manager');

        return;
    }

    logger.log('INFO', 'Guessit binary has been found');
    logger.log('INFO', 'Using local guessit binary');

    useBinary = true;
});

export default {
    async identify(search) {
        if (useBinary) {
            return binary(search);
        }

        return web.parseName(search);
    }
};
