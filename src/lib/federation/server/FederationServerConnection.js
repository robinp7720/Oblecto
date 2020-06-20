export default class FederationServerConnection {
    constructor(socket) {
        this.socket = socket;
        this.socket.on('data', chunk => this.dataHandler(chunk, this));
        this.socket.on('close', () => this.closeHandler(this));
        this.socket.on('error', error => this.errorHandler(error, this));
        this.dataRead = '';
    }

    dataHandler(chunk, _this) {
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

        console.log(split);

        switch (split[0]) {
        case 'CLIENTID':
            _this.clientIdHandler(split[1], _this);
            break;
        }
    }

    clientIdHandler(clientId, _this) {
        _this.clientId = clientId;
    }

    closeHandler(_this) {
        console.log('Connection has closed');
    }

    errorHandler(error, _this) {
        console.log('An error has occured', error);
    }

    write(header, content, _this) {
        _this.socket.write(`${header}:${content}\n`);
    }
}
