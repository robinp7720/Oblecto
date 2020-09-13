import FederationServerConnection from './FederationServerConnection';
import {File} from '../../../models/file';

export default class FederationMediaServerConnection extends FederationServerConnection {
    constructor(oblecto, socket) {
        super(oblecto, socket);
        this.clientId = null;
        this.fileId = null;
        this.fileInfo = null;
        this.offset = 0;
    }

    async headerHandler(data) {
        super.headerHandler(data);

        if (!this.authenticated) return;

        let split = data.split(':');

        switch (split[0]) {
            case 'FILEID':
                await this.setFileId(split[1]);
                break;
            case 'OFFSET':
                this.setOffset(split[1]);
                break;
            case 'START':
                await this.startStream();
                break;
        }
    }

    setOffset(offset) {
        this.offset = offset;
    }

    async setFileId(data) {
        this.fileId = data;
        this.fileInfo = null;

        try {
            this.fileInfo = await File.findByPk(this.fileId);
            this.socket.write(`READY:${this.fileId}\n`);

        } catch (e) {
            this.socket.write('ERROR:FILEID\n');
        }
    }

    async startStream() {
        if (!this.fileInfo) return;

        let streamSession = this.oblecto.streamSessionController.newSession(this.fileInfo, {
            streamType: 'recode',

            format: 'mkv',
            videoCodec: 'copy',
            audioCodec: 'copy',

            offset: this.offset
        });

        await streamSession.addDestination({
            stream: this.socket,
        });

        await streamSession.startStream();
    }
}
