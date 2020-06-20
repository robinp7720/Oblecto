import tls from 'tls';
import fs from 'fs';

export default class FederationClient{
    constructor (host, port) {
        this.socket = tls.connect({
            host,
            port: port || 9132,

            ca: [fs.readFileSync('/etc/oblecto/keys/public-cert.pem')]
        });

        this.host = host;
        this.port = port;

        this.socket.on('data', chunk => this.dataHandler(chunk, this));
        this.socket.on('secureConnect', () => this.secureConnectHandler(this));
        this.socket.on('error', this.errorHandler);
        this.socket.on('close', () => this.closeHandler(this));
        this.dataRead = '';
    }

    write(header, content) {
        this.socket.write(`${header}:${content}\n`);
    }

    dataHandler (chunk, _this) {
        _this.dataRead += chunk.toString();
        let split = _this.dataRead.split('\n');

        if (split.length < 2) return;

        for (let item of split) {
            if (item === '') continue;

            _this.dataRead = _this.dataRead.replace(item + '\n', '');
            _this.headerHandler(item, _this);
        }
    }

    headerHandler(data, _this) {
        let split = data.split(':');

        switch (split[0]) {
        case 'SERVERID':
            _this.clientIdHandler(split[1], _this);
            break;
        }
    }

    secureConnectHandler(_this) {
        console.log("Secure Connection initated");
    }

    errorHandler (error) {
        console.log(error);
    }

    closeHandler (_this) {
        console.log('Connection has closed');
    }
}
