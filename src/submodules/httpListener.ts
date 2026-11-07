import { createServer, type RequestListener, type Server } from 'node:http';
import type { ListenOptions } from 'node:net';

/** Separate listener readiness, stopping intake, and waiting for active HTTP responses. */
export class HttpListener {
    readonly server: Server;
    private starting?: Promise<void>;
    private stopping = false;
    private stopped?: Promise<void>;
    private failure?: Error;

    constructor(handler: RequestListener) {
        this.server = createServer((req, res) => {
            if (this.stopping) {
                res.writeHead(503, { 'Content-Type': 'application/json', Connection: 'close' });
                res.end(JSON.stringify({ code: 503, message: 'Server is shutting down' }));
                return;
            }
            handler(req, res);
        });
    }

    start(options: ListenOptions): Promise<void> {
        if (this.stopping) return Promise.reject(new Error('HTTP listener has stopped'));
        this.starting ??= new Promise<void>((resolve, reject) => {
            const failed = (error: Error): void => {
                this.server.off('listening', ready);
                reject(error);
            };
            const ready = (): void => {
                this.server.off('error', failed);
                resolve();
            };
            this.server.once('error', failed);
            this.server.once('listening', ready);
            try {
                this.server.listen(options);
            } catch (error) {
                this.server.off('error', failed);
                this.server.off('listening', ready);
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
        return this.starting;
    }

    /** Stop accepting connections now; existing responses may still need playback to finish. */
    stop(): void {
        this.stopping = true;
        this.stopped ??= (async () => {
            await this.starting?.catch(() => {});
            await new Promise<void>(resolve => {
                this.server.close(error => {
                    // Socket.IO and Primus can also close the HTTP server they are attached to.
                    if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') this.failure = error;
                    resolve();
                });
            });
        })();
    }

    async close(): Promise<void> {
        this.stop();
        await this.stopped;
        if (this.failure) throw this.failure;
    }
}
