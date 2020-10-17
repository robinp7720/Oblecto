import mimeTypes from 'mime-types';
import StreamSession from '../StreamSession';
import fs from 'fs';
import logger from '../../../submodules/logger';

export default class DirectStreamSession extends StreamSession {
    constructor(file, options, oblecto) {
        super(file, options, oblecto);

        this.mimeType = mimeTypes.lookup(file.path);
    }

    async addDestination(destination) {
        await super.addDestination(destination);

        if (destination.type === 'http') {
            this.destinations[0].request.writeHead(200, {
                'Content-Length': this.file.size,
                'Content-Type': this.mimeType
            });
        }
    }

    async startStream() {
        await super.startStream();

        try {
            fs.createReadStream(this.file.path).pipe(this.outputStream);
        } catch (e) {
            logger.log(e);
        }
    }
}
