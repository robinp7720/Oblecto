import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { Socket } from 'socket.io';
import type Oblecto from '../../src/lib/oblecto/index.js';
import RealtimeClient from '../../src/lib/realtime/RealtimeClient.js';
import RealtimeController from '../../src/lib/realtime/RealtimeController.js';

describe('Realtime playback shutdown', () => {
    it('awaits one final progress flush before closing the socket server', async () => {
        const socket = new EventEmitter() as EventEmitter & { disconnect: () => void };
        socket.disconnect = () => { socket.emit('disconnect'); };
        const client = new RealtimeClient({} as Oblecto, socket as unknown as Socket);
        let release!: () => void;
        let saves = 0;
        client.saveAllTracks = () => {
            saves++;
            return new Promise<void>(resolve => { release = resolve; });
        };
        let closed = false;
        const controller = {
            clients: { client },
            server: { close: (callback: () => void) => { closed = true; callback(); return Promise.resolve(); } }
        } as unknown as RealtimeController;
        const closing = RealtimeController.prototype.close.call(controller);
        assert.equal(closed, false);
        assert.equal(saves, 1);
        release();
        await closing;
        assert.equal(closed, true);
        await client.disconnect();
        assert.equal(saves, 1);
    });
});
