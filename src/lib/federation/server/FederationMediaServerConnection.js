import FederationServerConnection from './FederationServerConnection';
import fs from "fs";
import databases from '../../../submodules/database';
import crypto from 'crypto';
import FederationController from './FederationController';

export default class FederationMediaServerConnection extends FederationServerConnection {
    constructor(socket) {
        super(socket);
        this.clientId = null;
        this.fileId = null;
    }

    headerHandler(data, _this) {
        super.headerHandler(data, _this);
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
