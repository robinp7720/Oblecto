import Jsftp from 'jsftp';
import SeedboxImportDriver from '../SeedboxImportDriver';

export default class SeedboxImportFTP extends SeedboxImportDriver {
    constructor(config) {
        super(config);

        this.ftp = new Jsftp({
            host: config.host,
            port: config.port || 21,
            user: config.username,
            pass: config.password
        });
    }

    async list(path) {
        return new Promise((resolve, reject) => {
            this.ftp.ls(path, (err, data) => {
                if (err) return reject(err);
                resolve(data);
            });
        });
    }

    async copy(origin, destination) {
        return new Promise((resolve, reject) => {
            this.ftp.get(origin, destination, err => {
                if (err) return reject(err);
                resolve();
            });
        });
    }
}
