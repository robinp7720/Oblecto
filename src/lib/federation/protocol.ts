import tls from 'node:tls';
import { randomUUID } from 'node:crypto';
import { FramedPeer } from './frames.js';
import type { Message } from './frames.js';
export const VERSION = 2;
export function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Expected an object');
    return value as Record<string, unknown>;
}
export function text(value: unknown, max = 4096): string {
    if (typeof value !== 'string' || !value.length || value.length > max || value.includes('\0'))
        throw new Error('Invalid text');
    return value;
}
export type Handler = (operation: string, payload: unknown) => Promise<unknown>;
/** Sequential inbound requests and bounded, independently timed outbound calls. */
export class PeerRPC {
    readonly peer: FramedPeer;
    private pending = new Map<string, {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
        timer: NodeJS.Timeout;
    }>();
    constructor(readonly socket: tls.TLSSocket, handler: Handler = async () => { throw new Error('Unsupported operation'); }) {
        this.peer = new FramedPeer(socket, async (message: Message, bytes) => {
            if (!message || typeof message !== 'object' || typeof message.op !== 'string' || typeof message.id !== 'string' || bytes.length)
                throw new Error('Invalid metadata frame');
            if (message.op === 'result' || message.op === 'error') {
                const request = this.pending.get(message.id);
                if (!request)
                    throw new Error('Unknown request');
                clearTimeout(request.timer);
                this.pending.delete(message.id);
                if (message.op === 'error')
                    request.reject(new Error(message.message ?? 'Peer request failed'));
                else
                    request.resolve(message.payload);
                return;
            }
            try {
                const payload = await handler(message.op, message.payload);
                await this.peer.send({
                    id: message.id, op: 'result', payload
                });
            }
            catch (error) {
                await this.peer.send({
                    id: message.id, op: 'error', message: error instanceof Error ? error.message : 'Peer request failed'
                });
            }
        });
        socket.on('error', () => { });
        socket.once('close', () => {
            for (const pending of this.pending.values()) {
                clearTimeout(pending.timer);
                pending.reject(new Error('Federation connection closed'));
            }
            this.pending.clear();
        });
    }
    request(op: string, payload: unknown = {}, timeout = 60000): Promise<unknown> {
        if (this.pending.size >= 16 || this.socket.destroyed)
            return Promise.reject(new Error('Federation connection unavailable'));
        const id = randomUUID();
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Federation request timed out')); this.close(); }, timeout);
            this.pending.set(id, {
                resolve, reject, timer
            });
            void this.peer.send({
                id, op, payload
            }).catch(error => {
                clearTimeout(timer);
                this.pending.delete(id);
                reject(error instanceof Error ? error : new Error('Federation write failed'));
                this.close();
            });
        });
    }
    close(): void { this.socket.destroy(); }
}
export async function connectTLS(address: string, port: number, ca: string, fingerprint?: string, onSocket?: (socket: tls.TLSSocket) => void): Promise<tls.TLSSocket> {
    const socket = tls.connect({
        host: address, port, ca, servername: tlsServername(address)
    });
    onSocket?.(socket);
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { socket.destroy(); reject(new Error('Federation connection timed out')); }, 10000);
        const fail = (error: Error) => { clearTimeout(timer); reject(error); };
        const closed = () => fail(new Error('Federation connection closed'));
        socket.once('close', closed);
        socket.once('error', fail);
        socket.once('secureConnect', () => {
            if (fingerprint && socket.getPeerCertificate().fingerprint256 !== fingerprint) {
                clearTimeout(timer);
                socket.destroy();
                reject(new Error('Peer certificate changed; pair again'));
                return;
            }
            clearTimeout(timer);
            socket.removeListener('error', fail);
            socket.removeListener('close', closed);
            resolve();
        });
    });
    return socket;
}
function tlsServername(address: string): string | undefined {
    return /^[\d.]+$/.test(address) || address.includes(':') ? undefined : address;
}
