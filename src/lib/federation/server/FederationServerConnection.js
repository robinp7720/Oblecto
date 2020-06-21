import NodeRSA from 'node-rsa';
import {promises as fs} from 'fs';
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

        console.log(this.challenge);
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

        console.log(split);

        switch (split[0]) {
        case 'IAM':
            this.clientIdHandler(split[1]);
            break;
        case 'CHALLENGE':
            this.authHandler(split[1]);
            break;
        default:
            if (!this.authenticated) {
                console.log('client is not authorized!');
                this.socket.destroy();
            }
            break;
        }
    }

    waitForAuthentication() {

    }

    async clientIdHandler(clientId) {
        this.cluidId = clientId;

        if (!this.oblecto.config.federation.clients[clientId])
            return;

        let key = await fs.readFile(this.oblecto.config.federation.clients[clientId].key);
        this.key = NodeRSA(key);

        this.write('CHALLENGE', this.key.encrypt(this.challenge, 'base64'));
    }

    authHandler(data) {
        console.log('Getting auth', data);

        if (data == this.challenge) {
            this.authenticated = true;
            console.log('Client has been authenticated!');
            this.write('AUTH','ACCEPTED');

            return;
        }

        this.write('AUTH','DENIED');
        this.socket.destroy();
    }

    closeHandler() {
        console.log('Connection has closed');
    }

    errorHandler(error) {
        console.log('An error has occured', error);
    }

    write(header, content) {
        this.socket.write(`${header}:${content}\n`);
    }
}
