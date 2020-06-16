import mimeTypes from 'mime-types';
import fs from 'fs';
import crypto from 'crypto';
import FederationClient from '../../lib/federation/client/FederationClient';
import FederationController from '../../lib/federation/server/FederationController';

export default class FederationStreamer {
    static streamFile(video, req, res) {

        let federationClient = new FederationClient(video.host);
        let socket = federationClient.socket;

        socket.once('data', (chunk) => {
            const decipher = crypto.createDecipheriv('aes-192-cbc', FederationController.getPrivateKey(), chunk);
            const cipher = crypto.createDecipheriv('aes-192-cbc', FederationController.getPublicKey(), chunk);

            decipher.pipe(res);
            socket.pipe(decipher);
            cipher.pipe(socket);

            socket.write(`FILEID:${video.path}\n`);

            decipher.on('data', chunk => console.log(chunk.toString()));
        });

        socket.write(`CLIENTID:${FederationController.federationServerId}\n`);
    }
}
