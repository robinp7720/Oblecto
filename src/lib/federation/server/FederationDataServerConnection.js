import FederationServerConnection from './FederationServerConnection';
import databases from '../../../submodules/database';

export default class FederationDataServerConnection extends FederationServerConnection {
    constructor(socket) {
        super(socket);
        this.fullSyncPermitted = true;
    }

    async headerHandler(data, _this) {
        super.headerHandler(data, _this);

        let split = data.split(':');

        switch (split[0]) {
        case 'SYNC':
            _this.syncHandler(split[1], _this);
            break;
        case 'OFFSET':
            break;
        case 'START':
            break;
        }
    }

    syncHandler(data, _this) {
        if (data === 'FULL') {
            if (!_this.fullSyncPermitted) return false;
            return _this.startFullSync(_this);
        }
    }

    async startFullSync(_this) {
        console.log('Starting full sync with client');
        await _this.syncFiles(_this);
    }

    async syncFiles(_this) {
        let results = await databases.file.findAll({
            include: [databases.movie, databases.episode]
        });

        for (let result of results) {
            let file = result.toJSON();

            let fileInfo = {};

            if (file.episodes[0]) {
                fileInfo.type = 'episode';
                fileInfo.tvdbid = file.episodes[0].tvdbid;
                fileInfo.tmdbid = file.episodes[0].tmdbid;
            }

            if (file.movies[0]) {
                fileInfo.type = 'movie';
                fileInfo.tmdbid = file.episodes[0].tmdbid;
            }

            let syncInfo = {
                id: file.id,
                duration: file.duration,
                fileInfo
            };

            _this.write('FILE', Buffer.from(JSON.stringify(syncInfo)).toString('base64'), _this);
        }

    }
}
