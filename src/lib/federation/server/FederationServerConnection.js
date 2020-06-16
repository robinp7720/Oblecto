import FederationController from './FederationController';
import crypto from "crypto";

export default class FederationServerConnection {
    constructor(socket) {
        this.socket = socket;
        this.socket.on('data', chunk => this.dataHandler(chunk, this));
        this.dataRead = "";
    }

    dataHandler(chunk, _this) {
        _this.dataRead += chunk.toString();
        console.log(_this.dataRead);
        let split = _this.dataRead.split('\n');

        if (split.length < 2) return;

        for (let item of split) {
            _this.dataRead = _this.dataRead.replace(item + '\n', '');
            _this.headerHandler(item, _this);
        }
    }

    headerHandler(data, _this) {
        let split = data.split(':');

        switch (split[0]) {
        case 'CLIENTID':
            _this.clientIdHandler(split[1], _this);
            break;
        }
    }

    clientIdHandler(clientId, _this) {
        console.log(`Initiating encryption for client ${clientId}`);

        _this.clientId = clientId;
        _this.socket.removeAllListeners('data');

        const publicKey = FederationController.getPublicKey(_this.clientId);
        const privateKey = FederationController.getPrivateKey();

        const iv = crypto.randomBytes(16);

        _this.cipher = crypto.createCipheriv('aes-192-cbc', publicKey, iv);
        _this.decipher = crypto.createDecipheriv('aes-192-cbc', privateKey, iv);

        _this.decipher.on('data', chunk => _this.dataHandler(chunk, _this));

        console.log('Redirecting to decipher stream..');
        //_this.cipher.pipe(_this.socket);

        _this.socket.write(iv);
        _this.socket.pipe(_this.decipher);

        _this.cipher.write(`SERVERID:${FederationController.federationServerId}`);
    }
}
