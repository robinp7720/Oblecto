import tls from 'tls';
import { promises as fs, readFileSync } from 'fs';
import NodeRSA from 'node-rsa';
import EventEmitter from 'events';
import logger from '../../../submodules/logger/index.js';

import type Oblecto from '../../oblecto/index.js';

type FederationServerConfig = {
    address: string;
    ca: string;
    dataPort: number;
    mediaPort: number;
};

type FederationConfig = {
    uuid: string;
    key: string;
    servers: Record<string, FederationServerConfig>;
    clients: Record<string, { key: string }>;
};

export default class FederationClient {
    public oblecto: Oblecto;
    public serverName: string;
    public host: string;
    public port: number;
    public isSecure: boolean;
    public authenticated: boolean;
    public eventEmitter: EventEmitter;
    public dataRead: string;
    public socket!: tls.TLSSocket;

    /**
     *
     * @param oblecto - Oblecto server instance
     * @param server - Federation server name
     */
    constructor(oblecto: Oblecto, server: string) {
        this.oblecto = oblecto;
        this.serverName = server;
        this.host = (oblecto.config.federation as FederationConfig).servers[server].address;
        this.port = 9131;
        this.isSecure = false;
        this.authenticated = false;

        this.eventEmitter = new EventEmitter();

        this.dataRead = '';
    }

    async connect(): Promise<void> {
        logger.info( 'Connecting to federation master:', this.serverName);

        this.socket = tls.connect({
            host: this.host,
            port: this.port,

            ca: [readFileSync((this.oblecto.config.federation as FederationConfig).servers[this.serverName].ca)]
        });

        this.socket.on('data', (chunk: Buffer) => this.dataHandler(chunk));
        this.socket.on('secureConnect', () => this.secureConnectHandler());
        this.socket.on('error', (error: Error) => this.errorHandler(error));
        this.socket.on('close', () => this.closeHandler());

        if (!this.isSecure) await this.waitForSecure();

        this.socket.write(`IAM:${(this.oblecto.config.federation as FederationConfig).uuid}\n`);

        await this.waitForAuth();
    }

    write(header: string, content: string): void {
        this.socket.write(`${header}:${content}\n`);
    }

    dataHandler(chunk: Buffer): void {
        this.dataRead += chunk.toString();
        const split = this.dataRead.split('\n');

        if (split.length < 2) return;

        for (const item of split) {
            if (item === '') continue;

            this.dataRead = this.dataRead.replace(item + '\n', '');
            this.headerHandler(item);
        }
    }

    headerHandler(data: string): void {
        const split = data.split(':');

        switch (split[0]) {
            case 'CHALLENGE':
                void this.challengeHandler(split[1]);
                break;
            case 'AUTH':
                this.authAcceptHandler(split[1]);
                break;
        }
    }

    async challengeHandler(data: string): Promise<void> {
         
        const pemKey = await fs.readFile((this.oblecto.config.federation as FederationConfig).key);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const key = new (NodeRSA)(pemKey);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const decrypted = key.decrypt(data, 'ascii') as string;

        this.write('CHALLENGE', decrypted);
    }

    authAcceptHandler(data: string): void {
        if (data === 'ACCEPTED') {
            this.authenticated = true;
            this.eventEmitter.emit('auth');
            return;
        }

        // This connection is no longer valid
        this.close();
    }

    secureConnectHandler(): void {
        this.isSecure = true;
    }

    errorHandler(error: Error): void {
        void error;
    }

    closeHandler(): void {

    }

    waitForSecure(): Promise<void> {
        return new Promise((resolve) => {
            this.socket.once('secureConnect', resolve);
        });
    }

    waitForAuth(): Promise<void> {
        return new Promise((resolve) => {
            this.eventEmitter.once('auth', resolve);
        });
    }

    close(): void {
        this.socket.destroy();
    }
}
