import express, { type Express, type Request, type Response, type RequestHandler } from 'express';
import type EmbyEmulation from '../../src/lib/embyEmulation/index.js';

export interface ItemDto {
    Id: string; Name: string; Type: string; SeriesName: string; IndexNumber: number; ParentIndexNumber: number;
    UserData: { PlaybackPositionTicks: number; PlayedPercentage: number; Played: boolean };
}
export interface ItemsResponse { SeriesName: string; Items: ItemDto[]; TotalRecordCount: number; StartIndex: number; SearchHints: ItemDto[] }
export class CapturedResponse<T> {
    statusCode = 200;
    body!: T;
    status(code: number): this { this.statusCode = code; return this; }
    send(payload: T): this { this.body = payload; return this; }
    json(payload: T): this { return this.send(payload); }
    end(): this { return this; }
}
export const makeRes = <T = ItemsResponse>(): CapturedResponse<T> => new CapturedResponse<T>();

class Handlers {
    private entries = new Map<string, RequestHandler>();
    set(key: string, handler: RequestHandler): void { this.entries.set(key, handler); }
    get(key: string): (request: object, response: object) => Promise<void> {
        const handler = this.entries.get(key);
        if (!handler) throw new Error(`Missing test route: ${key}`);
        return async (request, response) => {
            // Only this adapter bridges an intentionally partial HTTP fixture to Express.
            const req = { headers: {}, params: {}, body: {}, ...request };
            Object.defineProperty(req, 'query', { value: 'query' in request ? request.query : {}, writable: false });
            await handler(req as Request, response as Response, error => { if (error) throw error; });
        };
    }
}
export function makeServer(): Express & { handlers: Handlers } {
    const handlers = new Handlers();
    const server = Object.assign(express(), { handlers });
    for (const method of ['get', 'post', 'put', 'delete', 'patch'] as const) {
        const register = (route: string, ...callbacks: RequestHandler[]): Express => {
            handlers.set(`${method.toUpperCase()} ${route}`, callbacks.at(-1)!);
            return server;
        };
        Object.defineProperty(server, method, { value: register, writable: true });
    }
    return server;
}

type PartialFixture<T> = T extends (...args: never[]) => unknown ? T : T extends object ? { [K in keyof T]?: PartialFixture<T[K]> } : T;
/** Route fixtures provide only the services exercised by that contract test. */
export function embyFixture(value: PartialFixture<EmbyEmulation>): EmbyEmulation {
    return value as EmbyEmulation;
}
