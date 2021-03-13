import tls from 'tls';
import { promises as fs } from 'fs';
import NodeRSA from 'node-rsa';
import EventEmitter from 'events';
import { readFileSync } from 'fs';
import logger from '../../../submodules/logger';

/**
 * @typedef {import('../../oblecto').default} Oblecto
 */

export default class FederationClient{
    /**
     *
     * @param {Oblecto} oblecto - Oblecto server instance
     * @param {string} server - Federation server name
     */
    constructor(oblecto, server) {
        this.oblecto = oblecto;
        this.serverName = server;
        this.host = oblecto.config.federation.servers[server].address;
        this.port = 9131;
        this.isSecure = false;
        this.authenticated = false;

        this.eventEmitter = new EventEmitter();

        this.dataRead = '';
    }

    async connect() {
        logger.log('INFO', 'Connecting to federation master:', this.serverName);

        this.socket = tls.connect({
            host: this.host,
            port: this.port ,

            ca: [readFileSync(this.oblecto.config.federation.servers[this.serverName].ca)]
        });

        this.socket.on('data', chunk => this.dataHandler(chunk));
        this.socket.on('secureConnect', () => this.secureConnectHandler());
        this.socket.on('error', (error) => this.errorHandler(error));
        this.socket.on('close', () => this.closeHandler());

        if (!this.isSecure) await this.waitForSecure();

        this.socket.write(`IAM:${this.oblecto.config.federation.uuid}\n`);

        await this.waitForAuth();
    }

    write(header, content) {
        this.socket.write(`${header}:${content}\n`);
    }

    dataHandler (chunk) {
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
            case 'CHALLENGE':
                this.challengeHandler(split[1]);
                break;
            case 'AUTH':
                this.authAcceptHandler(split[1]);
                break;
        }
    }

    async challengeHandler(data) {
        const pemKey = await fs.readFile(this.oblecto.config.federation.key);
        const key = NodeRSA(pemKey);

        const decrypted = key.decrypt(data, 'ascii');

        this.write('CHALLENGE', decrypted);
    }

    async authAcceptHandler(data) {
        if (data === 'ACCEPTED') {
            this.authenticated = true;
            this.eventEmitter.emit('auth');
            return;
        }

        delete this;
    }

    secureConnectHandler() {
        this.isSecure = true;
    }

    errorHandler (error) {

    }

    closeHandler () {

    }

    waitForSecure() {
        return new Promise((resolve, reject) => {
            this.socket.once('secureConnect', resolve);
        });
    }

    waitForAuth() {
        return new Promise((resolve, reject) => {
            this.eventEmitter.once('auth', resolve);
        });
    }

    close() {
        this.socket.destroy();
    }
}
