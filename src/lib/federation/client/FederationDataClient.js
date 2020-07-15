import FederationClient from './FederationClient';

export default class FederationDataClient extends FederationClient {
    /**
     *
     * @param {Oblecto} oblecto
     * @param {string} server
     */
    constructor(oblecto, server) {
        super(oblecto, server);

        this.port = oblecto.config.federation.servers[server].dataPort;
    }

    headerHandler(data) {
        super.headerHandler(data);

        let split = data.split(':');

        switch (split[0]) {
            case 'FILE':
                this.fileHandler(split[1]);
                break;
        }
    }

    requestFullSync() {
        this.write('SYNC', 'FULL');
    }

    async fileHandler(data) {
        let input = Buffer.from(data, 'base64').toString();

        let file = JSON.parse(input);
        file.host = this.serverName;

        switch (file.fileInfo.type) {
            case 'episode':
                this.oblecto.queue.queueJob('federationIndexEpisode', file);
                break;
            case 'movie':
                this.oblecto.queue.queueJob('federationIndexMovie', file);
                break;
        }

    }
}
