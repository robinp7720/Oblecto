import FederationServerConnection from './FederationServerConnection';
import databases from '../../../submodules/database';
import FFMPEGStreamer from '../../../submodules/handlers/FFMPEGStreamer';

export default class FederationMediaServerConnection extends FederationServerConnection {
    constructor(socket) {
        super(socket);
        this.clientId = null;
        this.fileId = null;
        this.fileInfo = null;
        this.offset = 0;
    }

    async headerHandler(data) {
        super.headerHandler(data);

        let split = data.split(':');

        switch (split[0]) {
        case 'FILEID':
            await this.setFileId(split[1]);
            break;
        case 'OFFSET':
            this.setOffset(split[1]);
            break;
        case 'START':
            this.startStream();
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
            this.fileInfo = await databases.file.findByPk(this.fileId);
            this.socket.write(`READY:${this.fileId}\n`);

        } catch (e) {
            this.socket.write('ERROR:FILEID\n');
        }
    }

    startStream() {
        if (!this.fileInfo) return;

        FFMPEGStreamer.streamFile(this.fileInfo, this.offset, null, this.socket);
        //fs.createReadStream(_this.fileInfo.path).pipe(_this.socket);
    }
}
