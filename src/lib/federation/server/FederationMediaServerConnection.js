import FederationServerConnection from './FederationServerConnection';
import fs from 'fs';
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

    async headerHandler(data, _this) {
        super.headerHandler(data, _this);

        let split = data.split(':');

        switch (split[0]) {
        case 'FILEID':
            await _this.setFileId(split[1], _this);
            break;
        case 'OFFSET':
            _this.setOffset(split[1], _this);
            break;
        case 'START':
            _this.startStream(_this);
            break;
        }
    }

    setOffset(offset, _this) {
        _this.offset = offset;
    }

    async setFileId(data, _this) {
        _this.fileId = data;
        _this.fileInfo = null;

        try {
            _this.fileInfo = await databases.file.findByPk(_this.fileId);
        } catch (e) {
            _this.socket.write('ERROR:FILEID\n');
            return;
        }
    }

    startStream(_this) {
        if (!_this.fileInfo) return;

        _this.socket.write(`START:${_this.fileId}\n`);

        FFMPEGStreamer.streamFile(_this.fileInfo, _this.offset, null, _this.socket);
        //fs.createReadStream(_this.fileInfo.path).pipe(_this.socket);
    }

    /*async dataHandler(chunk, _this) {
        super.dataHandler(chunk, _this);

        let header = chunk.toString();

        if (!_this.clientId) {
            let split = header.split(':');
            _this.clientId = split[0];
            _this.fileId = split[1];

            return;
        }
        const publicKey = FederationController.getPublicKey(_this.clientId);

        //const publicKey = crypto.randomBytes(24);
        const iv = crypto.randomBytes(16);

        console.log(iv);

        _this.socket.write(iv);

        _this.cipher = crypto.createCipheriv('aes-192-cbc', publicKey, iv);

        _this.cipher.pipe(_this.socket);

        console.log(_this.clientId);
        console.log(_this.fileId);

        let fileInfo;

        try {
            fileInfo = await databases.file.findByPk(_this.fileId);
        } catch (e) {
            console.log(e);
            return;
        }

        fs.createReadStream(fileInfo.path).pipe(_this.cipher);

    }*/
}
