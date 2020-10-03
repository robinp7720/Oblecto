import StreamSession from '../StreamSession';
import mimeTypes from 'mime-types';
import fs from 'fs';
import logger from '../../../submodules/logger';

export default class DirectHttpStreamSession extends StreamSession {
    constructor(file, options, oblecto) {
        super(file, options, oblecto);

        this.format = this.file.extension;
        this.videoCodec = this.file.videoCodec;
        this.audioCodec = this.file.audioCodec;
    }

    async addDestination(destination) {
        // HTTP Streamer only supports a single destination
        if (destination.type !== 'http') {
            logger.log('ERROR', 'DirectHttpStreamer only supports http stream types');
            return;
        }

        if (this.destinations[0])
            this.destinations[0].stream.destroy();

        this.destinations[0] = destination;

        destination.stream.on('close', () => {
            this.startTimeout();
        });
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
