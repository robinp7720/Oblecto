import mimeTypes from 'mime-types';
import fs from 'fs';

export default class {
    static streamFile(oblecto, videoPath, req, res, next) {

        let videoSize = fs.statSync(videoPath).size;
        let videoMime =  mimeTypes.lookup(videoPath);

        if (req.headers.range) { // meaning client (browser) has moved the forward/back slider
            // which has sent this request back to this server logic ... cool
            var range = req.headers.range;
            var parts = range.replace(/bytes=/, '').split('-');
            var partialstart = parts[0];
            var partialend = parts[1];

            var start = parseInt(partialstart, 10);
            var end = partialend ? parseInt(partialend, 10) : videoSize  - 1;
            var chunksize = (end - start) + 1;

            console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize);

            try {
                var file = fs.createReadStream(videoPath, {
                    start: start,
                    end: end
                });
            } catch (e) {
                console.log(e);
                return next();
            }

            res.writeHead(206, {
                'Content-Range': 'bytes ' + start + '-' + end + '/' + videoSize,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': videoMime
            });

            return file.pipe(res);

        } else {

            console.log('ALL: ' + videoSize);

            res.writeHead(200, {
                'Content-Length': videoSize,
                'Accept-Ranges': 'bytes',
                'Content-Type': videoMime
            });

            try {
                return fs.createReadStream(videoPath).pipe(res);
            } catch (e) {
                console.log(e);
                return next();
            }
        }

    }
}
