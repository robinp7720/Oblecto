import NodeRSA from 'node-rsa';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

import type Oblecto from '../../oblecto/index.js';
import type tls from 'tls';

export default class FederationServerConnection {
    public oblecto: Oblecto;
    public socket: tls.TLSSocket;
    public dataRead: string;
    public clientId: string;
    public authenticated: boolean;
    public challenge: string;
    public key?: NodeRSA;

    constructor(oblecto: Oblecto, socket: tls.TLSSocket) {
        this.oblecto = oblecto;
        this.socket = socket;
        this.socket.on('data', (chunk: Buffer) => this.dataHandler(chunk));
        this.socket.on('close', () => this.closeHandler());
        this.socket.on('error', (error: Error) => this.errorHandler(error));
        this.dataRead = '';

        this.clientId = '';
        this.authenticated = false;
        this.challenge = uuidv4();
    }

    dataHandler(chunk: Buffer): void {
        this.dataRead += chunk.toString();
        const split = this.dataRead.split('\n');

        if (split.length < 2) return;

        for (const item of split) {
            if (item === '') continue;

            this.dataRead = this.dataRead.replace(item + '\n', '');
            void this.headerHandler(item);
        }
    }

    async headerHandler(data: string): Promise<void> {
        const split = data.split(':');

        switch (split[0]) {
            case 'IAM':
                await this.clientIdHandler(split[1]);
                break;
            case 'CHALLENGE':
                this.authHandler(split[1]);
                break;
            default:
                if (!this.authenticated) {
                    this.socket.destroy();
                }
                break;
        }
    }

    async clientIdHandler(clientId: string): Promise<void> {
        this.clientId = clientId;

        // Check if the client server is known
        // If an unknown client is trying to connect, we should just ignore it
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (!this.oblecto.config.federation.clients[clientId]) return;

        const key = await fs.readFile(this.oblecto.config.federation.clients[clientId].key);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        this.key = new (NodeRSA)(key);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.write('CHALLENGE', (this.key as any).encrypt(this.challenge, 'base64') as string);
    }

    authHandler(data: string): void {
        if (data === this.challenge) {
            this.authenticated = true;
            this.write('AUTH','ACCEPTED');

            return;
        }

        this.write('AUTH','DENIED');
        this.socket.destroy();
    }

    closeHandler(): void {

    }

    errorHandler(error: Error): void {
        void error;
    }

    write(header: string, content: string): void {
        this.socket.write(`${header}:${content}\n`);
    }

    close(): void {
        this.socket.destroy();
    }
}
