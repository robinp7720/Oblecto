import hbjs from "handbrake-js";

export default {
    transcode: (input, output, callback) => {
        hbjs.spawn({input, output, 'main-feature': true})
            .on('error', err => {
                console.log('Error transcoding', input);
                callback();
                // invalid user input, no video found etc
            })
            .on('progress', progress => {
                console.log(
                    input,
                    'Percent complete: %s, ETA: %s',
                    progress.percentComplete,
                    progress.eta
                )
            })
            .on('end', () => callback);
    }
}