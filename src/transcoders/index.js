import path from 'path';
import dvd from './dvd';
import fs from 'fs';

export default {
    transcode: (input, callback) => {
        let parsed = path.parse(input);
        let extension = parsed.ext.replace('.', '').toLowerCase();
        switch (extension) {
            case 'iso':
                fs.exists(input.replace(parsed.ext, '.mp4'), function (exists) {
                    if (exists)
                        return callback();
                    console.log(input, " is an iso disk image. Starting transcode");
                    dvd.transcode(input, input.replace(parsed.ext, '.mp4'), callback);
                });
                break;
            default:
                console.log('Cannot transcode', input);
                callback();
                break;
        }
    }
}