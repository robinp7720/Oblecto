import StreamSession from '../StreamSession';
import mimeTypes from 'mime-types';
import fs from 'fs';

export default class DirectHttpStreamSession extends StreamSession {
    constructor(file, options, oblecto) {
        super(file, options, oblecto);
    }

    async addDestination(destination) {
        // HTTP Streamer only supports a single destination
        this.destinations[0] = destination;
    }

    async startStream() {
        await super.startStream();

        let req = this.destinations[0].request;
        let res = this.destinations[0].stream;

        let mimeType = mimeTypes.lookup(this.file.path);

        if (req.headers.range) { // meaning client (browser) has moved the forward/back slider
            // which has sent this request back to this server logic ... cool
            let range = req.headers.range;
            let parts = range.replace(/bytes=/, '').split('-');
            let partialstart = parts[0];
            let partialend = parts[1];

            let start = parseInt(partialstart, 10);
            let end = partialend ? parseInt(partialend, 10) : this.file.size  - 1;
            let chunksize = (end - start) + 1;

            console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize);

            let stream;

            try {
                stream = fs.createReadStream(this.file.path, {
                    start: start,
                    end: end
                });
            } catch (e) {
                console.log(e);
            }

            res.writeHead(206, {
                'Content-Range': 'bytes ' + start + '-' + end + '/' + this.file.size,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': mimeType
            });

            stream.pipe(res);

            return;

        }

        console.log('ALL: ' + this.file.size);

        res.writeHead(200, {
            'Content-Length': this.file.size,
            'Accept-Ranges': 'bytes',
            'Content-Type': mimeType
        });

        try {
            fs.createReadStream(this.file.path).pipe(res);
        } catch (e) {
            console.log(e);
        }
    }

}
