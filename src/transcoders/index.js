import path from 'path';
import dvd from './dvd';
import fs from 'fs';
import config from '../config';

export default {
    transcode: (input, callback) => {
        let parsed = path.parse(input);
        let extension = parsed.ext.replace('.', '');
        console.log(extension);
        switch (extension) {
            case 'iso':
                fs.exists(input.replace('iso', 'mp4'), function (exists) {
                    if (exists)
                        return callback();
                    console.log("File is an iso disk image. Starting transcode");
                    dvd.transcode(input, input.replace('iso', 'mp4'), callback);
                });
                break;
            default:
                console.log('Cannot transcode', input);
                callback();
                break;
        }
    }
}