import NodeRSA from 'node-rsa';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

export default class FederationServerConnection {
    constructor(oblecto, socket) {
        this.oblecto = oblecto;
        this.socket = socket;
        this.socket.on('data', chunk => this.dataHandler(chunk));
        this.socket.on('close', () => this.closeHandler());
        this.socket.on('error', error => this.errorHandler(error));
        this.dataRead = '';

        this.clientId = '';
        this.authenticated = false;
        this.challenge = uuidv4();
    }

    dataHandler(chunk) {
        this.dataRead += chunk.toString();
        let split = this.dataRead.split('\n');

        if (split.length < 2) return;

        for (let item of split) {
            if (item === '') continue;

            this.dataRead = this.dataRead.replace(item + '\n', '');
            this.headerHandler(item);
        }
    }

    headerHandler(data) {
        let split = data.split(':');

        switch (split[0]) {
            case 'IAM':
                this.clientIdHandler(split[1]);
                break;
            case 'CHALLENGE':
                this.authHandler(split[1]);
                break;
            default:
                if (!this.authenticated) {
                    this.socket.destroy();
                }
                break;
        }
    }

    async clientIdHandler(clientId) {
        this.clientId = clientId;

        // Check if the client server is known
        // If an unknown client is trying to connect, we should just ignore it
        if (!this.oblecto.config.federation.clients[clientId]) return;

        let key = await fs.readFile(this.oblecto.config.federation.clients[clientId].key);

        this.key = NodeRSA(key);

        this.write('CHALLENGE', this.key.encrypt(this.challenge, 'base64'));
    }

    authHandler(data) {
        if (data === this.challenge) {
            this.authenticated = true;
            this.write('AUTH','ACCEPTED');

            return;
        }

        this.write('AUTH','DENIED');
        this.socket.destroy();
    }

    closeHandler() {

    }

    errorHandler(error) {

    }

    write(header, content) {
        this.socket.write(`${header}:${content}\n`);
    }

    close() {
        this.socket.close();
    }
}
