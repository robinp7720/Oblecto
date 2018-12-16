import hbjs from "handbrake-js";

export default {
    transcode: (input, output, callback) => {
        hbjs.spawn({input, output, 'main-feature': true})
            .on('error', err => {
                console.log('Error transcoding', input, err);
                callback();
                // invalid user input, no video found etc
            })
            .on('progress', progress => {
                console.log(
                    'Percent complete: %s, ETA: %s, File: %s',
                    progress.percentComplete,
                    progress.eta,
                    input
                )
            })
            .on('end', callback);
    }
}