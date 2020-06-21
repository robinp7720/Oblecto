export default class FederationServerConnection {
    constructor(socket) {
        this.socket = socket;
        this.socket.on('data', chunk => this.dataHandler(chunk));
        this.socket.on('close', () => this.closeHandler());
        this.socket.on('error', error => this.errorHandler(error));
        this.dataRead = '';
    }

    dataHandler(chunk) {
        this.dataRead += chunk.toString();
        let split = this.dataRead.split('\n');

        if (split.length < 2) return;

        for (let item of split) {
            if (item === '') continue;

            this.dataRead = this.dataRead.replace(item + '\n', '');
            this.headerHandler(item,);
        }
    }

    headerHandler(data, _this) {
        let split = data.split(':');

        console.log(split);

        switch (split[0]) {
        case 'CLIENTID':
            _this.clientIdHandler(split[1]);
            break;
        }
    }

    clientIdHandler(clientId) {
        this.clientId = clientId;
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
