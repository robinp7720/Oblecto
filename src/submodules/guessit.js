import web from 'guessit-wrapper';
import binary from 'guessit-exec';
import which from 'which';

let use_binary = true;

which('guessit', function (err, resolvedPath) {
    if (err) {
        console.log('Guessit is not installed, Using web based identifier');

        return;
    }

    use_binary = true;
    console.log('Guessit binary has been found at', resolvedPath);
});

export default {
    async identify(search) {
        if (use_binary) {
            return binary(search);
        }

        return web.parseName(search);
    }
};
