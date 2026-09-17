import tls from 'node:tls';
import { promises as fs } from 'node:fs';
import {privateDecrypt,
    publicEncrypt,
    randomBytes,
    randomUUID} from 'node:crypto';
import { Writable } from 'node:stream';
import type { Request, Response } from 'express';
import type Oblecto from '../oblecto/index.js';
import { File } from '../../models/file.js';
import { PlaybackError } from './types.js';
import type { PlaybackOptions } from './types.js';
import type {PlaybackSession,
    RemotePlayback,
    RemoteSessionData} from './PlaybackService.js';

type Payload = {
    version?: number;
    clientId?: string;
    fileId?: string | number;
    sessionId?: string;
    options?: PlaybackOptions;
    revision?: number;
    asset?: string;
    method?: string;
    range?: string;
};
type Message = {
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
    constructor(
        readonly socket: tls.TLSSocket,
        readonly receive: (
            message: Message,
            bytes: Buffer
        ) => Promise<void> | void
    ) {
        socket.on('data', (data) => {
            this.buffer = Buffer.concat([
                new Uint8Array(this.buffer),
                new Uint8Array(data)
            ]);
            void this.drain();
        });
    }
    private async drain(): Promise<void> {
        if (this.processing) return;
        this.processing = true;
        this.socket.pause();
        try {
            while (this.buffer.length >= 8) {
                const length = this.buffer.readUInt32BE(0);
                const headerLength = this.buffer.readUInt32BE(4);
                if (
                    length > 1024 * 1024 ||
                    headerLength > 65536 ||
                    headerLength > length - 4 ||
                    headerLength < 2
                )
                    throw new Error('Invalid federation frame');
                if (this.buffer.length < length + 4) break;
                const message = JSON.parse(
                    this.buffer.subarray(8, 8 + headerLength).toString()
                ) as Message;
                const bytes = this.buffer.subarray(
                    8 + headerLength,
                    4 + length
                );
                this.buffer = this.buffer.subarray(4 + length);
                await this.receive(message, bytes);
            }
        } catch {
            this.socket.destroy();
        } finally {
            this.processing = false;
            this.socket.resume();
        }
    }
    send(message: Message, bytes = Buffer.alloc(0)): Promise<void> {
        const header = Buffer.from(JSON.stringify(message));
        const prefix = Buffer.alloc(8);
        prefix.writeUInt32BE(4 + header.length + bytes.length, 0);
        prefix.writeUInt32BE(header.length, 4);
        if (
            header.length > 65536 ||
            bytes.length + header.length + 4 > 1024 * 1024
        )
            return Promise.reject(
                new PlaybackError(
                    'REMOTE_PROTOCOL',
                    'Federation frame exceeds limit',
                    502
                )
            );
        return new Promise((resolve, reject) => {
            if (this.socket.destroyed)
                return reject(
                    new PlaybackError(
                        'REMOTE_UNAVAILABLE',
                        'Federation connection closed',
                        502
                    )
                );
            this.socket.write(
                new Uint8Array(
                    Buffer.concat(
                        [prefix, header, bytes].map((b) => new Uint8Array(b))
                    )
                ),
                (error) => (error ? reject(error) : resolve())
            );
        });
    }
}
class RemoteResponse extends Writable {
    headers: Record<string, string | number> = {};
    headersSent = false;
    statusCode = 200;
    constructor(
        readonly peer: FramedPeer,
        readonly id: string
    ) {
        super();
    }
    setHeader(key: string, value: string | number): this {
        this.headers[key] = value;
        return this;
    }
    status(code: number): this {
        this.statusCode = code;
        return this;
    }
    type(value: string): this {
        return this.setHeader('Content-Type', value);
    }
    send(value: string): this {
        this.end(value);
        return this;
    }
    async flushHeaders(): Promise<void> {
        if (this.headersSent) return;
        this.headersSent = true;
        await this.peer.send({
            op: 'headers',
            id: this.id,
            status: this.statusCode,
            headers: this.headers
        });
    }
    _write(
        chunk: Buffer,
        _encoding: BufferEncoding,
        callback: (error?: Error | null) => void
    ): void {
        void (async () => {
            await this.flushHeaders();
            for (let i = 0; i < chunk.length; i += 32768)
                await this.peer.send(
                    { op: 'data', id: this.id },
                    chunk.subarray(i, i + 32768)
                );
        })().then(() => callback(), callback);
    }
    _final(callback: (error?: Error | null) => void): void {
        void this.flushHeaders()
            .then(() => this.peer.send({ op: 'end', id: this.id }))
            .then(() => callback(), callback);
    }
}
export function acceptPlaybackPeer(
    oblecto: Oblecto,
    socket: tls.TLSSocket
): void {
    const owner = `peer:${randomUUID()}`;
    let challenge = '';
    let authenticated = false;
    let authenticating = false;
    const active = new Map<string, RemoteResponse>();
    const timer = setTimeout(() => socket.destroy(), 10000);
    const respondError = (message: Message, error: unknown) =>
        peer
            .send({
                id: message.id,
                op: 'error',
                code:
                    error instanceof PlaybackError
                        ? error.code
                        : 'REMOTE_UNAVAILABLE',
                message:
                    error instanceof PlaybackError
                        ? error.message
                        : 'Remote playback failed',
                status: error instanceof PlaybackError ? error.statusCode : 502
            })
            .catch(() => {});
    const peer = new FramedPeer(socket, async (message) => {
        const payload = (message.payload ?? {}) as Payload;
        if (!authenticated) {
            if (message.op === 'hello' && !authenticating) {
                if (payload.version !== 1) {
                    await respondError(
                        message,
                        new PlaybackError(
                            'REMOTE_PROTOCOL',
                            'Upgrade both federation peers to playback protocol 1',
                            426
                        )
                    );
                    socket.end();
                    return;
                }
                const client =
                    oblecto.config.federation.clients[payload.clientId ?? ''];
                if (!client) {
                    socket.destroy();
                    return;
                }
                authenticating = true;
                challenge = randomBytes(32).toString('hex');
                const key = await fs.readFile(client.key);
                await peer.send({
                    op: 'challenge',
                    payload: publicEncrypt(
                        key.toString(),
                        new Uint8Array(Buffer.from(challenge))
                    ).toString('base64')
                });
            } else if (
                message.op === 'authenticate' &&
                challenge &&
                message.payload === challenge
            ) {
                authenticated = true;
                clearTimeout(timer);
                await peer.send({ op: 'authenticated' });
            } else socket.destroy();
            return;
        }
        if (message.op === 'cancel') {
            active.get(message.id!)?.destroy();
            return;
        }
        // Do not block the frame reader while streaming; it must continue accepting cancellation.
        void (async () => {
            if (message.op === 'create') {
                const file = await File.findByPk(payload.fileId);
                if (!file || (file.host && file.host !== 'local'))
                    throw new PlaybackError(
                        'MEDIA_NOT_FOUND',
                        'Remote source is not local to this peer',
                        404
                    );
                const s = await oblecto.playback.create(
                    file,
                    owner,
                    null,
                    payload.options
                );
                if (socket.destroyed) {
                    await oblecto.playback.stop(s);
                    return;
                }
                await peer.send({
                    op: 'result',
                    id: message.id,
                    payload: serialize(s)
                });
                return;
            }
            const session = oblecto.playback.get(
                String(payload.sessionId),
                owner
            );
            if (message.op === 'serve') {
                const response = new RemoteResponse(peer, message.id!);
                active.set(message.id!, response);
                response.on('error', () => {});
                const req = {
                    method: payload.method === 'HEAD' ? 'HEAD' : 'GET',
                    headers: { range: payload.range }
                } as Request;
                try {
                    await oblecto.playback.serve(
                        session,
                        Number(payload.revision),
                        String(payload.asset),
                        req,
                        response as unknown as Response
                    );
                } finally {
                    active.delete(message.id!);
                }
                return;
            }
            if (message.op === 'update')
                await oblecto.playback.update(
                    session,
                    payload.options ?? {},
                    Number(payload.revision)
                );
            else if (message.op === 'stop')
                await oblecto.playback.stop(session);
            else if (message.op === 'heartbeat') session.touch();
            else
                throw new PlaybackError(
                    'REMOTE_PROTOCOL',
                    'Unknown playback operation'
                );
            await peer.send({
                op: 'result',
                id: message.id,
                payload: serialize(session)
            });
        })().catch((error) => respondError(message, error));
    });
    socket.on('error', () => {});
    socket.on('close', () => {
        clearTimeout(timer);
        for (const response of active.values()) response.destroy();
        for (const s of oblecto.playback.sessions.values())
            if (s.owner === owner) void oblecto.playback.stop(s);
    });
}
const serialize = (s: PlaybackSession) => ({
    sessionId: s.sessionId,
    revision: s.revision,
    media: { ...s.media, path: '' },
    plan: s.plan
});

export async function connectPlaybackPeer(
    oblecto: Oblecto,
    host: string
): Promise<RemotePlayback> {
    const config = oblecto.config.federation.servers[host];
    if (!config)
        throw new PlaybackError(
            'REMOTE_UNAVAILABLE',
            'Federation peer is not configured',
            503
        );
    const socket = tls.connect({
        host: config.address,
        port: config.mediaPort,
        ca: [await fs.readFile(config.ca)]
    });
    type Pending = {
        resolve: (value: RemoteSessionData) => void;
        reject: (error: Error) => void;
        timer: NodeJS.Timeout;
        response?: Response;
        chunks?: Buffer[];
        playlist?: boolean;
    };
    const requests = new Map<string, Pending>();
    let authenticated = false;
    let revision = 1;
    let readyResolve: () => void;
    let readyReject: (error: Error) => void;
    const ready = new Promise<void>((resolve, reject) => {
        readyResolve = resolve;
        readyReject = reject;
    });
    const timeout = setTimeout(() => {
        readyReject(
            new PlaybackError(
                'REMOTE_TIMEOUT',
                'Federation authentication timed out',
                504
            )
        );
        socket.destroy();
    }, 10000);
    const failure = () => {
        clearTimeout(timeout);
        const error = new PlaybackError(
            'REMOTE_UNAVAILABLE',
            'Federation connection closed',
            502
        );
        readyReject(error);
        for (const pending of requests.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        requests.clear();
    };
    socket.on('error', failure);
    socket.on('close', failure);
    const peer = new FramedPeer(socket, async (message, bytes) => {
        if (!authenticated) {
            if (message.op === 'challenge') {
                const key = await fs.readFile(oblecto.config.federation.key);
                await peer.send({
                    op: 'authenticate',
                    payload: privateDecrypt(
                        key.toString(),
                        new Uint8Array(
                            Buffer.from(String(message.payload), 'base64')
                        )
                    ).toString()
                });
            } else if (message.op === 'authenticated') {
                authenticated = true;
                clearTimeout(timeout);
                readyResolve();
            } else if (message.op === 'error') {
                readyReject(
                    new PlaybackError(
                        message.code!,
                        message.message!,
                        message.status
                    )
                );
                socket.destroy();
            }
            return;
        }
        const pending = requests.get(message.id!);
        if (!pending) return;
        pending.timer.refresh();
        if (message.op === 'headers' && pending.response) {
            pending.response.status(message.status ?? 200);
            const contentType = String(message.headers?.['Content-Type'] ?? '');
            pending.playlist = contentType.includes('mpegurl');
            if (pending.playlist) pending.chunks = [];
            for (const [key, value] of Object.entries(message.headers ?? {}))
                if (!pending.playlist || key.toLowerCase() !== 'content-length')
                    pending.response.setHeader(key, value);
        } else if (message.op === 'data' && pending.response) {
            if (pending.playlist) pending.chunks!.push(bytes);
            else if (!pending.response.write(bytes))
                await new Promise<void>((resolve) => {
                    const done = () => {
                        pending.response!.removeListener('drain', done);
                        pending.response!.removeListener('close', done);
                        resolve();
                    };
                    pending.response!.once('drain', done);
                    pending.response!.once('close', done);
                });
        } else if (['end', 'result', 'error'].includes(message.op)) {
            requests.delete(message.id!);
            clearTimeout(pending.timer);
            if (message.op === 'error') {
                pending.reject(
                    new PlaybackError(
                        message.code!,
                        message.message!,
                        message.status
                    )
                );
                return;
            }
            if (pending.response) {
                // Relative asset URLs stay on the receiving server; retain its scoped token.
                if (pending.playlist)
                    pending.response.end(
                        Buffer.concat(
                            pending.chunks!.map((b) => new Uint8Array(b))
                        )
                            .toString()
                            .replace(
                                /\?token=[a-f0-9]+/g,
                                `?token=${pending.response.locals.playbackToken}`
                            )
                    );
                else pending.response.end();
            }
            const result = message.payload as RemoteSessionData;
            if (result?.revision) revision = result.revision;
            pending.resolve(result);
        }
    });
    socket.once('secureConnect', () => {
        void peer
            .send({
                op: 'hello',
                payload: {
                    version: 1,
                    clientId: oblecto.config.federation.uuid
                }
            })
            .catch(failure);
    });
    try {
        await ready;
    } catch (error) {
        clearTimeout(timeout);
        socket.destroy();
        throw error;
    }
    const request = (op: string, payload: unknown, response?: Response) =>
        new Promise<RemoteSessionData>((resolve, reject) => {
            const id = randomUUID();
            const timer = setTimeout(() => {
                requests.delete(id);
                void peer.send({ op: 'cancel', id }).catch(() => {});
                reject(
                    new PlaybackError(
                        'REMOTE_TIMEOUT',
                        'Remote playback timed out',
                        504
                    )
                );
            }, 60000);
            requests.set(id, {
                resolve,
                reject,
                timer,
                response
            });
            const cancel = () => {
                if (requests.delete(id)) {
                    clearTimeout(timer);
                    void peer.send({ op: 'cancel', id }).catch(() => {});
                    resolve(undefined as unknown as RemoteSessionData);
                }
            };
            response?.once('close', cancel);
            void peer
                .send({
                    op,
                    id,
                    payload
                })
                .catch((error) => {
                    clearTimeout(timer);
                    requests.delete(id);
                    reject(
                        error instanceof Error
                            ? error
                            : new Error('Federation write failed')
                    );
                });
        });
    return {
        request,
        async serve(sessionId, asset, req, res) {
            res.locals.playbackToken = req.query?.token;
            await request(
                'serve',
                {
                    sessionId,
                    asset,
                    revision,
                    method: req.method,
                    range: req.headers.range
                },
                res
            );
        },
        close() {
            socket.destroy();
        }
    };
}
