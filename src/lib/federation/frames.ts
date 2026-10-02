import type tls from 'node:tls';
import { PlaybackError } from '../playback/types.js';
export type Message = {
    id?: string;
    op: string;
    payload?: unknown;
    code?: string;
    message?: string;
    status?: number;
    headers?: Record<string, string | number>;
};
/** Each frame contains a bounded JSON header and optional raw bytes; source bytes never enter the JSON parser. */
export class FramedPeer {
    private buffer = Buffer.alloc(0);
    private processing = false;
    constructor(readonly socket: tls.TLSSocket, readonly receive: (message: Message, bytes: Buffer) => Promise<void> | void) {
        socket.on('data', (data) => {
            this.buffer = Buffer.concat([
                new Uint8Array(this.buffer),
                new Uint8Array(data)
            ]);
            void this.drain();
        });
    }
    private async drain(): Promise<void> {
        if (this.processing)
            return;
        this.processing = true;
        this.socket.pause();
        try {
            while (this.buffer.length >= 8) {
                const length = this.buffer.readUInt32BE(0);
                const headerLength = this.buffer.readUInt32BE(4);
                if (length > 1024 * 1024 ||
                    headerLength > 65536 ||
                    headerLength > length - 4 ||
                    headerLength < 2)
                    throw new Error('Invalid federation frame');
                if (this.buffer.length < length + 4)
                    break;
                const message = JSON.parse(this.buffer.subarray(8, 8 + headerLength).toString()) as Message;
                const bytes = this.buffer.subarray(8 + headerLength, 4 + length);
                this.buffer = this.buffer.subarray(4 + length);
                if (!message || typeof message !== 'object' || typeof message.op !== 'string' || message.op.length > 128)
                    throw new Error('Invalid federation message');
                await this.receive(message, bytes);
            }
        }
        catch {
            this.socket.destroy();
        }
        finally {
            this.processing = false;
            this.socket.resume();
        }
    }
    send(message: Message, bytes: Buffer = Buffer.alloc(0)): Promise<void> {
        const header = Buffer.from(JSON.stringify(message));
        const prefix = Buffer.alloc(8);
        prefix.writeUInt32BE(4 + header.length + bytes.length, 0);
        prefix.writeUInt32BE(header.length, 4);
        if (header.length > 65536 ||
            bytes.length + header.length + 4 > 1024 * 1024)
            return Promise.reject(new PlaybackError('REMOTE_PROTOCOL', 'Federation frame exceeds limit', 502));
        return new Promise((resolve, reject) => {
            if (this.socket.destroyed)
                return reject(new PlaybackError('REMOTE_UNAVAILABLE', 'Federation connection closed', 502));
            this.socket.write(new Uint8Array(Buffer.concat([prefix, header, bytes].map((b) => new Uint8Array(b)))), (error) => (error ? reject(error) : resolve()));
        });
    }
}
