import tls from 'tls';
import fs from 'fs';

export default class FederationClient{
    constructor (host, port) {
        this.host = host;
        this.port = port || 9132;
        this.isSecure = false;

        this.dataRead = '';
    }

    async connect() {
        this.socket = tls.connect({
            host: this.host,
            port: this.port ,

            ca: [fs.readFileSync('/etc/oblecto/keys/public-cert.pem')]
        });

        this.socket.on('data', chunk => this.dataHandler(chunk));
        this.socket.on('secureConnect', () => this.secureConnectHandler());
        this.socket.on('error', () => this.errorHandler());
        this.socket.on('close', () => this.closeHandler());

        if (this.isSecure) return;

        await this.waitForSecure();
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
        case 'SERVERID':
            this.clientIdHandler(split[1]);
            break;
        }
    }

    secureConnectHandler() {
        this.isSecure = true;

        console.log('Secure Connection initated');
    }

    errorHandler (error) {
        console.log(error);
    }

    closeHandler (_this) {
        console.log('Connection has closed');
    }

    waitForSecure() {
        return new Promise((resolve, reject) => {
            this.socket.once('secureConnect', resolve);
        });
    }
}
