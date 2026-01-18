import FederationServerConnection from './FederationServerConnection.js';
import { File } from '../../../models/file.js';
import logger from '../../../submodules/logger/index.js';

import type Oblecto from '../../oblecto/index.js';
import type tls from 'tls';

export default class FederationMediaServerConnection extends FederationServerConnection {
    public fileId: string | null;
    public fileInfo: File | null;
    public offset: number;

    constructor(oblecto: Oblecto, socket: tls.TLSSocket) {
        super(oblecto, socket);
        this.fileId = null;
        this.fileInfo = null;
        this.offset = 0;
    }

    async headerHandler(data: string): Promise<void> {
        super.headerHandler(data);

        if (!this.authenticated) return;

        const split = data.split(':');

        switch (split[0]) {
            case 'FILEID':
                await this.setFileId(split[1]);
                break;
            case 'OFFSET':
                this.setOffset(split[1]);
                break;
            case 'START':
                await this.startStream();
                break;
        }
    }

    setOffset(offset: string): void {
        this.offset = Number(offset);
    }

    async setFileId(data: string): Promise<void> {
        this.fileId = data;
        this.fileInfo = null;

        try {
            this.fileInfo = await File.findByPk(this.fileId);
            this.socket.write(`READY:${this.fileId}\n`);
        } catch (e) {
            this.socket.write('ERROR:FILEID\n');
        }
    }

    async startStream(): Promise<void> {
        if (!this.fileInfo) return;

        const streamSession = this.oblecto.streamSessionController.newSession(this.fileInfo, {
            streamType: 'recode',

            target: {
                formats: ['matroska'],
                videoCodecs: ['copy'],
                audioCodecs: ['copy'],
            },

            offset: this.offset
        });

        await streamSession.addDestination({ stream: this.socket, type: 'socket' });

        await streamSession.startStream();
    }

    async closeHandler(): Promise<void> {
        logger.info( 'Federation media stream has closed');
    }
}
