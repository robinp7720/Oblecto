import { Movie } from '../../models/movie.js';
import { Episode } from '../../models/episode.js';
import { Series } from '../../models/series.js';
import tls from 'node:tls';
import type { Socket } from 'node:net';
import { promises as fs } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import type Oblecto from '../oblecto/index.js';
import type { IConfig } from '../../interfaces/config.js';
import { ConfigManager } from '../../config.js';
import { FederationRecord } from '../../models/federationRecord.js';
import { File } from '../../models/file.js';
import { MovieFiles } from '../../models/movieFiles.js';
import { EpisodeFiles } from '../../models/episodeFiles.js';
import { acceptPlaybackPeer } from '../playback/federation.js';
import { PeerRPC, VERSION, connectTLS, record, text } from './protocol.js';
import { applySnapshot, createSnapshot, snapshotPage, validateFile } from './catalog.js';
import { checkProof, digest, fingerprint, publicKeyPEM, identity, proof, provision, storeTrust, validateIdentity } from './identity.js';
import type { Identity } from './identity.js';
import logger from '../../submodules/logger/index.js';
interface Health {
    state: string;
    lastSuccess?: string;
    count?: number;
    error?: string;
    retryAt?: string;
    operationId?: string;
}
interface Worker {
    rpc?: PeerRPC;
    timer?: NodeJS.Timeout;
    task?: Promise<void>;
    stopped: boolean;
    attempt: number;
    health: Health;
}
interface Pairing {
    id: string;
    state: 'pending' | 'prepared' | 'active' | 'cancelled';
    remote: Identity;
    expires: number;
    incoming: boolean;
    error?: string;
}
type FederationConfig = IConfig['federation'];
export const safeError = (error: unknown): string => {
    const message = error instanceof Error ? error.message : '';
    if (error instanceof SyntaxError)
        return 'Invalid federation data.';
    if (/certificate|self.signed|hostname|altname/i.test(message))
        return 'Certificate verification failed. Check the peer hostname and trust material.';
    if (/ENOENT|EACCES|PEM|DECODER/i.test(message))
        return 'Federation identity or trust material could not be read.';
    if (/ECONN|ENOTFOUND|EHOST|ETIMEDOUT/i.test(message))
        return 'Peer is unreachable. Check its address, ports and firewall.';
    return message.replace(/[\r\n]/g, ' ').slice(0, 240) || 'Federation operation failed';
};
/** Owns federation listeners, trust, synchronization and live configuration. */
export class FederationService {
    private servers: tls.Server[] = [];
    private rawSockets = new Set<Socket>();
    private sockets = new Set<tls.TLSSocket>();
    private socketClients = new Map<tls.TLSSocket, string>();
    private workers = new Map<string, Worker>();
    private tasks = new Set<Promise<unknown>>();
    private tail = Promise.resolve();
    private running?: FederationConfig;
    private stopped = false;
    private cleanup?: NodeJS.Timeout;
    private error?: string;
    private pairings = new Map<string, Pairing>();
    private invitations = new Map<string, {
        hash: string;
        expires: number;
        claimedBy?: string;
    }>();
    private pairingBusy = new Set<string>();
    constructor(readonly oblecto: Oblecto) { }
    private track<T>(task: Promise<T>): Promise<T> {
        this.tasks.add(task);
        void task.finally(() => this.tasks.delete(task)).catch(() => { });
        return task;
    }
    private serialize<T>(action: () => Promise<T>): Promise<T> {
        const task = this.tail.then(action);
        this.tail = task.then(() => { }, () => { });
        return task;
    }
    async start(): Promise<void> {
        for (const row of await FederationRecord.findAll({ where: { scope: 'pairing' } })) {
            const pairing = JSON.parse(row.value) as Pairing;
            this.pairings.set(pairing.id, pairing);
        }
        for (const row of await FederationRecord.findAll({ where: { scope: 'invitation', expires: { [Op.gt]: Date.now() } } })) {
            const saved = JSON.parse(row.value) as {
                hash: string;
                claimedBy?: string;
            };
            if (this.pairings.get(row.key)?.state !== 'active' && this.pairings.get(row.key)?.state !== 'cancelled')
                this.invitations.set(row.key, { ...saved, expires: row.expires! });
        }
        await this.apply();
        this.cleanup = setInterval(() => {
            this.background(this.expire());
            for (const pairing of this.pairings.values())
                if (!pairing.incoming && (pairing.state === 'prepared' || pairing.state === 'pending'))
                    this.background(this.finishPairing(pairing));
        }, 30000);
        this.cleanup.unref();
    }
    private background(task: Promise<unknown>): void { void this.track(task).catch(error => logger.warn('Federation:', safeError(error))); }
    private async expire(): Promise<void> {
        await FederationRecord.destroy({ where: { expires: { [Op.lt]: Date.now() }, scope: { [Op.notIn]: ['pairing', 'status'] } } });
        for (const [id, invitation] of this.invitations)
            if (invitation.expires < Date.now())
                this.invitations.delete(id);
        for (const pairing of this.pairings.values())
            if (pairing.state !== 'active' && pairing.state !== 'cancelled' && pairing.expires < Date.now())
                await this.cancelPairing(pairing.id);
    }
    async configure(change: (draft: IConfig) => void): Promise<void> {
        return this.serialize(async () => {
            if (this.stopped)
                throw new Error('Federation is stopping');
            await ConfigManager.updateConfig(change, this.oblecto.config);
            await this.applyNow();
        });
    }
    apply(): Promise<void> { return this.serialize(() => this.applyNow()); }
    private async applyNow(): Promise<void> {
        if (this.stopped)
            return;
        const desired = structuredClone(this.oblecto.config.federation);
        const old = this.running;
        const listenersChanged = !old || ['enable', 'key', 'cert', 'dataPort', 'mediaPort', 'uuid'].some(key => old[key as keyof FederationConfig] !== desired[key as keyof FederationConfig]);
        for (const [alias, worker] of this.workers) {
            if (listenersChanged || JSON.stringify(old?.servers[alias]) !== JSON.stringify(desired.servers[alias]) || !desired.enable)
                await this.stopWorker(alias, worker);
        }
        for (const [socket, uuid] of this.socketClients) {
            if (listenersChanged || (old?.clients[uuid] && JSON.stringify(old.clients[uuid]) !== JSON.stringify(desired.clients[uuid])))
                socket.destroy();
        }
        if (listenersChanged)
            await this.closeListeners();
        this.error = undefined;
        try {
            if (desired.enable && (listenersChanged || !this.servers.length)) {
                const options = {
                    handshakeTimeout: 10000, key: await fs.readFile(desired.key), cert: await fs.readFile(desired.cert!)
                };
                const data = tls.createServer(options, socket => this.accept(socket));
                const media = tls.createServer(options, socket => {
                    this.trackSocket(socket);
                    acceptPlaybackPeer(this.oblecto, socket, clientId => this.socketClients.set(socket, clientId), task => this.background(task));
                });
                this.servers = [data, media];
                for (const server of this.servers)
                    server.on('connection', (socket: Socket) => {
                        this.rawSockets.add(socket);
                        socket.once('close', () => this.rawSockets.delete(socket));
                    });
                await Promise.all(this.servers.map((server, i) => new Promise<void>((resolve, reject) => {
                    server.once('error', reject);
                    server.listen(i === 0 ? desired.dataPort : desired.mediaPort, () => { server.removeListener('error', reject); resolve(); });
                    server.on('error', error => { this.error = safeError(error); });
                })));
            }
            this.running = desired;
        }
        catch (error) {
            this.error = safeError(error);
            await this.closeListeners();
            this.running = undefined;
            return;
        }
        if (!desired.enable)
            return;
        for (const alias of Object.keys(desired.servers)) {
            if (desired.servers[alias].enabled === false || this.workers.has(alias))
                continue;
            const saved = await FederationRecord.findOne({ where: { scope: 'status', key: alias } });
            const health = saved ? JSON.parse(saved.value) as Health : { state: 'disconnected' };
            const worker: Worker = {
                stopped: false, attempt: 0, health
            };
            this.workers.set(alias, worker);
            this.runWorker(alias, worker);
        }
    }
    private trackSocket(socket: tls.TLSSocket): void {
        this.sockets.add(socket);
        if (this.stopped)
            socket.destroy();
        socket.on('error', () => { });
        socket.once('close', () => { this.sockets.delete(socket); this.socketClients.delete(socket); });
    }
    private accept(socket: tls.TLSSocket): void {
        this.trackSocket(socket);
        const nonce = randomBytes(32).toString('hex');
        let clientId = '';
        let hello = false;
        let authenticated = false;
        let exported: {
            snapshot: string;
            count: number;
            offset: number;
            expires: number;
        } | undefined;
        const timer = setTimeout(() => socket.destroy(), 10000);
        socket.once('close', () => {
            clearTimeout(timer);
            if (exported)
                this.background(FederationRecord.destroy({ where: { scope: `export:${exported.snapshot}` } }));
        });
        socket.setTimeout(60000, () => socket.destroy());
        new PeerRPC(socket, (op, input) => this.track((async () => {
            const payload = record(input);
            if (op === 'hello' && !hello) {
                if (payload.version !== VERSION)
                    throw new Error('Upgrade both peers to federation metadata protocol 2');
                hello = true;
                return { nonce, uuid: this.oblecto.config.federation.uuid };
            }
            if (!hello)
                throw new Error('Send hello before authentication');
            if (op === 'identity')
                return { identity: await identity(this.oblecto.config.federation), signature: proof(await fs.readFile(this.oblecto.config.federation.key, 'utf8'), text(payload.nonce, 128), 'callback') };
            if (op === 'pair') {
                return this.claimInvitation(payload, nonce, () => clearTimeout(timer));
            }
            if (op === 'authenticate' && !authenticated) {
                clientId = text(payload.uuid, 128);
                const client = Object.hasOwn(this.oblecto.config.federation.clients, clientId) ? this.oblecto.config.federation.clients[clientId] : undefined;
                const pending = [...this.pairings.values()].find(pairing => pairing.remote.uuid === clientId && pairing.state === 'prepared' && pairing.expires > Date.now());
                const key = client && client.enabled !== false ? await fs.readFile(client.key, 'utf8') : pending?.remote.publicKey;
                if (!key || !checkProof(key, nonce, payload.signature))
                    throw new Error('Peer authentication failed');
                if (client && (this.oblecto.config.federation.clients[clientId]?.key !== client.key || this.oblecto.config.federation.clients[clientId]?.enabled === false))
                    throw new Error('Peer authorization was revoked');
                authenticated = true;
                clearTimeout(timer);
                this.socketClients.set(socket, clientId);
                return {};
            }
            if (!authenticated)
                throw new Error('Peer authentication required');
            if (op === 'pair.commit') {
                const pairing = this.pairings.get(text(payload.id, 128));
                if (pairing?.remote.uuid !== clientId || pairing.state === 'cancelled' || (pairing.state !== 'active' && pairing.expires < Date.now()))
                    throw new Error('Pairing is unavailable');
                await this.activate(pairing);
                return {};
            }
            const client = this.oblecto.config.federation.clients[clientId];
            if (!client || client.enabled === false)
                throw new Error('Peer authorization required');
            if (op === 'snapshot.start') {
                if (exported)
                    await FederationRecord.destroy({ where: { scope: `export:${exported.snapshot}` } });
                exported = {
                    ...await createSnapshot(() => socket.destroyed || this.stopped), offset: 0, expires: Date.now() + 3600000
                };
                if (socket.destroyed) {
                    await FederationRecord.destroy({ where: { scope: `export:${exported.snapshot}` } });
                    throw new Error('Connection closed');
                }
                return { snapshot: exported.snapshot, count: exported.count };
            }
            if (op === 'snapshot.page') {
                if (!exported || payload.snapshot !== exported.snapshot || payload.offset !== exported.offset || exported.expires < Date.now())
                    throw new Error('Snapshot is unavailable');
                const items = await snapshotPage(exported.snapshot, exported.offset);
                exported.offset += items.length;
                const complete = exported.offset === exported.count;
                if (!items.length && !complete)
                    throw new Error('Snapshot expired');
                return {
                    snapshot: exported.snapshot, offset: exported.offset, items, complete
                };
            }
            throw new Error('Unsupported federation operation');
        })()));
    }
    private async authenticate(rpc: PeerRPC, expectedUuid?: string): Promise<void> {
        const hello = record(await rpc.request('hello', { version: VERSION }, 10000));
        if (expectedUuid && hello.uuid !== expectedUuid)
            throw new Error('Peer identity changed; pair again');
        await rpc.request('authenticate', { uuid: this.oblecto.config.federation.uuid, signature: proof(await fs.readFile(this.oblecto.config.federation.key, 'utf8'), text(hello.nonce, 128)) }, 10000);
    }
    private async connect(alias: string): Promise<PeerRPC> {
        const config = this.oblecto.config.federation;
        if (!config.enable || !Object.hasOwn(config.servers, alias) || config.servers[alias].enabled === false)
            throw new Error('Peer is disabled');
        const server = config.servers[alias];
        const rpc = new PeerRPC(await connectTLS(server.address, server.dataPort, await fs.readFile(server.ca, 'utf8'), server.fingerprint, socket => this.trackSocket(socket)));
        try {
            await this.authenticate(rpc, server.uuid);
            return rpc;
        }
        catch (error) {
            rpc.close();
            throw error;
        }
    }
    private runWorker(alias: string, worker: Worker): void {
        if (worker.stopped || worker.task)
            return;
        worker.health.operationId = randomUUID();
        worker.task = this.track((async () => {
            worker.health = {
                ...worker.health, state: 'connecting', error: undefined, retryAt: undefined
            };
            try {
                worker.rpc = await this.connect(alias);
                if (worker.stopped)
                    return;
                worker.health.state = 'syncing';
                worker.health.operationId ||= randomUUID();
                await this.sync(alias, worker);
                worker.attempt = 0;
                worker.health = {
                    state: 'connected', lastSuccess: new Date().toISOString(), count: worker.health.count, operationId: worker.health.operationId
                };
            }
            catch (error) {
                worker.health.state = 'error';
                worker.health.error = safeError(error);
                worker.attempt++;
            }
            finally {
                worker.rpc?.close();
                worker.rpc = undefined;
                if (!worker.stopped) {
                    const delay = worker.attempt ? Math.min(60000, 1000 * 2 ** Math.min(worker.attempt, 6) * (0.8 + Math.random() * 0.4)) : this.oblecto.config.federation.syncIntervalMs ?? 900000;
                    worker.health.retryAt = new Date(Date.now() + delay).toISOString();
                    await FederationRecord.upsert({
                        scope: 'status', key: alias, value: JSON.stringify(worker.health), expires: null
                    });
                    worker.timer = setTimeout(() => this.runWorker(alias, worker), delay);
                    worker.timer.unref();
                }
            }
        })());
        void worker.task.finally(() => { worker.task = undefined; }).catch(error => logger.warn('Federation sync:', safeError(error)));
    }
    private async sync(alias: string, worker: Worker): Promise<void> {
        const start = record(await worker.rpc!.request('snapshot.start'));
        const remoteSnapshot = text(start.snapshot, 128);
        const count = Number(start.count);
        if (!Number.isSafeInteger(count) || count < 0)
            throw new Error('Invalid snapshot count');
        const snapshot = randomUUID();
        let offset = 0;
        try {
            for (;;) {
                if (worker.stopped)
                    throw new Error('Synchronization cancelled');
                const page = record(await worker.rpc!.request('snapshot.page', { snapshot: remoteSnapshot, offset }));
                if (page.snapshot !== remoteSnapshot || !Array.isArray(page.items) || page.items.length > 100 || page.offset !== offset + page.items.length || Number(page.offset) > count)
                    throw new Error('Invalid snapshot page');
                for (const input of page.items) {
                    const file = validateFile(input);
                    await FederationRecord.create({
                        scope: `import:${snapshot}`, key: String(offset++).padStart(12, '0'), value: JSON.stringify(file), expires: Date.now() + 3600000
                    });
                }
                if (page.complete === true) {
                    if (offset !== count)
                        throw new Error('Incomplete snapshot');
                    break;
                }
                if (!page.items.length)
                    throw new Error('Empty incomplete snapshot');
            }
            const added = await applySnapshot(alias, snapshot, count, () => worker.stopped || this.stopped);
            for (const item of added) {
                if (item.kind === 'movie' && this.oblecto.movieArtworkCollector) {
                    const movie = await Movie.findByPk(item.id);
                    if (movie) {
                        await this.oblecto.movieArtworkCollector.collectArtworkMoviePoster(movie);
                        await this.oblecto.movieArtworkCollector.collectArtworkMovieFanart(movie);
                    }
                }
                else if (item.kind === 'series' && this.oblecto.seriesArtworkCollector) {
                    const series = await Series.findByPk(item.id);
                    if (series) {
                        await this.oblecto.seriesArtworkCollector.collectArtworkSeriesPoster(series);
                        await this.oblecto.seriesArtworkCollector.collectArtworkSeriesFanart(series);
                    }
                }
                else if (item.kind === 'episode' && this.oblecto.seriesArtworkCollector) {
                    const episode = await Episode.findByPk(item.id);
                    if (episode)
                        await this.oblecto.seriesArtworkCollector.collectArtworkEpisodeBanner(episode);
                }
            }
            worker.health.count = count;
        }
        finally {
            await FederationRecord.destroy({ where: { scope: `import:${snapshot}` } });
        }
    }
    syncNow(alias: string): string {
        const worker = this.workers.get(alias);
        if (!worker)
            throw new Error('Peer is disabled or unavailable');
        if (!worker.task) {
            clearTimeout(worker.timer);
            worker.health.operationId = randomUUID();
            this.runWorker(alias, worker);
        }
        return worker.health.operationId ?? '';
    }
    async test(alias: string): Promise<void> { const rpc = await this.connect(alias); rpc.close(); }
    async reconnect(alias: string): Promise<void> {
        await this.serialize(async () => {
            const worker = this.workers.get(alias);
            if (worker)
                await this.stopWorker(alias, worker);
            await this.applyNow();
        });
    }
    status(): unknown {
        return {
            enabled: this.oblecto.config.federation.enable,
            running: Boolean(this.servers.length),
            error: this.error,
            peers: Object.entries(this.oblecto.config.federation.servers).map(([id, config]) => ({
                id, name: config.name ?? id, address: config.address, enabled: config.enabled !== false, ...(this.workers.get(id)?.health ?? { state: 'disabled' })
            })),
            pairings: [...this.pairings.values()].map(pairing => ({
                id: pairing.id, state: pairing.state, uuid: pairing.remote.uuid, expires: pairing.expires, error: pairing.error
            }))
        };
    }
    async setup(address: string): Promise<Identity> {
        const config = await provision(this.oblecto.config.federation, address);
        await this.configure(draft => { draft.federation = config; });
        return identity(config);
    }
    async getIdentity(): Promise<Identity> { return identity(this.oblecto.config.federation); }
    async invitation(): Promise<unknown> {
        if (!this.servers.length)
            throw new Error('Enable federation before creating an invitation');
        const id = randomUUID();
        const secret = randomBytes(32).toString('base64url');
        const expires = Date.now() + 600000;
        this.invitations.set(id, { hash: digest(secret), expires });
        await FederationRecord.upsert({
            scope: 'invitation', key: id, value: JSON.stringify({ hash: digest(secret) }), expires
        });
        return {
            id,
            expires,
            invitation: Buffer.from(JSON.stringify({
                id, secret, expires, identity: await this.getIdentity()
            })).toString('base64url')
        };
    }
    async revokeInvitation(id: string): Promise<void> {
        this.invitations.delete(id);
        await FederationRecord.destroy({ where: { scope: 'invitation', key: id } });
        if (this.pairings.has(id))
            await this.cancelPairing(id);
    }
    async pair(invitation: string): Promise<string> {
        if (!this.servers.length)
            throw new Error('Enable federation before pairing');
        const input = record(JSON.parse(Buffer.from(text(invitation, 48000), 'base64url').toString()));
        const remote = validateIdentity(input.identity);
        const id = text(input.id, 128);
        if (!Number.isSafeInteger(input.expires) || Number(input.expires) <= Date.now() || Number(input.expires) > Date.now() + 600000)
            throw new Error('Invitation has expired');
        if (remote.uuid === this.oblecto.config.federation.uuid)
            throw new Error('Cannot pair a server with itself');
        const existing = this.pairings.get(id);
        if (existing && (existing.remote.uuid !== remote.uuid || existing.remote.certificate !== remote.certificate))
            throw new Error('Pairing identity does not match the original invitation');
        if (existing?.state === 'active')
            return id;
        if (existing && this.pairingBusy.has(id))
            return id;
        if (existing?.state === 'prepared' || (existing?.state === 'pending' && !existing.error))
            return id;
        if (existing?.state === 'cancelled')
            throw new Error('Pairing was cancelled');
        const pairing: Pairing = existing ?? {
            id, state: 'pending', remote, incoming: false, expires: Number(input.expires)
        };
        pairing.error = undefined;
        this.pairingBusy.add(id);
        try {
            await this.savePairing(pairing);
        }
        catch (error) {
            this.pairingBusy.delete(id);
            throw error;
        }
        this.background((async () => {
            const rpc = new PeerRPC(await connectTLS(remote.address, remote.dataPort, remote.certificate, fingerprint(remote.certificate), socket => this.trackSocket(socket)));
            try {
                const hello = record(await rpc.request('hello', { version: VERSION }, 10000));
                if (hello.uuid !== remote.uuid)
                    throw new Error('Peer identity changed');
                await rpc.request('pair', {
                    id, secret: text(input.secret, 128), identity: await this.getIdentity(), signature: proof(await fs.readFile(this.oblecto.config.federation.key, 'utf8'), text(hello.nonce, 128))
                });
                if (pairing.state === 'cancelled')
                    return;
                pairing.state = 'prepared';
                await this.savePairing(pairing);
            }
            finally {
                rpc.close();
            }
            this.pairingBusy.delete(id);
            await this.finishPairing(pairing);
        })().catch(async (error) => { pairing.error = safeError(error); await this.savePairing(pairing); }).finally(() => this.pairingBusy.delete(id)));
        return id;
    }
    private async claimInvitation(payload: Record<string, unknown>, nonce: string, accepted: () => void): Promise<unknown> {
        const id = text(payload.id, 128);
        const invitation = this.invitations.get(id);
        const remote = validateIdentity(payload.identity);
        if (!invitation || invitation.expires < Date.now() || invitation.hash !== digest(text(payload.secret, 128)))
            throw new Error('Invitation is invalid or expired');
        if (remote.uuid === this.oblecto.config.federation.uuid || (invitation.claimedBy && invitation.claimedBy !== remote.uuid))
            throw new Error('Invitation has already been used');
        if (!checkProof(remote.publicKey, nonce, payload.signature))
            throw new Error('Peer identity proof failed');
        accepted();
        if (this.pairingBusy.has(id))
            throw new Error('Pairing is already in progress');
        this.pairingBusy.add(id);
        try {
            invitation.claimedBy = remote.uuid;
            await FederationRecord.upsert({
                scope: 'invitation', key: id, value: JSON.stringify({ hash: invitation.hash, claimedBy: invitation.claimedBy }), expires: invitation.expires
            });
            const rpc = new PeerRPC(await connectTLS(remote.address, remote.dataPort, remote.certificate, fingerprint(remote.certificate), socket => this.trackSocket(socket)));
            try {
                await rpc.request('hello', { version: VERSION }, 10000);
                const challenge = randomBytes(32).toString('hex');
                const response = record(await rpc.request('identity', { nonce: challenge }, 10000));
                const actual = validateIdentity(response.identity);
                if (actual.uuid !== remote.uuid || actual.publicKey !== remote.publicKey || !checkProof(remote.publicKey, challenge, response.signature, 'callback'))
                    throw new Error('Callback identity verification failed');
            }
            finally {
                rpc.close();
            }
            if (this.invitations.get(id) !== invitation || invitation.expires < Date.now() || this.stopped)
                throw new Error('Invitation is unavailable');
            const pairing: Pairing = {
                id, remote, incoming: true, state: 'prepared', expires: invitation.expires
            };
            await this.savePairing(pairing);
            return {};
        }
        finally {
            this.pairingBusy.delete(id);
        }
    }
    private async finishPairing(pairing: Pairing): Promise<void> {
        if (this.pairingBusy.has(pairing.id) || !['pending', 'prepared'].includes(pairing.state) || pairing.expires <= Date.now())
            return;
        this.pairingBusy.add(pairing.id);
        try {
            const rpc = new PeerRPC(await connectTLS(pairing.remote.address, pairing.remote.dataPort, pairing.remote.certificate, fingerprint(pairing.remote.certificate), socket => this.trackSocket(socket)));
            try {
                await this.authenticate(rpc, pairing.remote.uuid);
                await rpc.request('pair.commit', { id: pairing.id });
            }
            finally {
                rpc.close();
            }
            if (pairing.state === 'prepared' || pairing.state === 'pending')
                await this.activate(pairing);
        }
        catch (error) {
            pairing.error = safeError(error);
            await this.savePairing(pairing);
        }
        finally {
            this.pairingBusy.delete(pairing.id);
        }
    }
    private async activate(pairing: Pairing): Promise<void> {
        if (pairing.state === 'active')
            return;
        if (pairing.state === 'cancelled' || pairing.expires < Date.now() || this.stopped)
            throw new Error('Pairing is unavailable');
        const remote = pairing.remote;
        const config = this.oblecto.config.federation;
        const alias = Object.keys(config.servers).find(key => config.servers[key].uuid === remote.uuid) ?? remote.uuid;
        const existing = config.servers[alias];
        if (existing && (await fs.readFile(existing.ca, 'utf8')) !== remote.certificate)
            throw new Error('Remove existing trust before replacing a certificate');
        const existingClient = config.clients[remote.uuid];
        if (existingClient && publicKeyPEM(await fs.readFile(existingClient.key, 'utf8')) !== publicKeyPEM(remote.publicKey))
            throw new Error('Revoke existing client trust before replacing its identity');
        const trust = await storeTrust(remote);
        await this.configure(draft => {
            if (pairing.state === 'cancelled' || pairing.expires < Date.now())
                throw new Error('Pairing is unavailable');
            draft.federation.servers[alias] = {
                address: remote.address, dataPort: remote.dataPort, mediaPort: remote.mediaPort, uuid: remote.uuid, ca: trust.ca, fingerprint: fingerprint(remote.certificate), enabled: true
            };
            draft.federation.clients[remote.uuid] = { key: trust.key, enabled: true };
        });
        pairing.error = undefined;
        pairing.state = 'active';
        await this.savePairing(pairing);
        this.invitations.delete(pairing.id);
        await FederationRecord.destroy({ where: { scope: 'invitation', key: pairing.id } });
    }
    private async savePairing(pairing: Pairing): Promise<void> {
        this.pairings.set(pairing.id, pairing);
        await FederationRecord.upsert({
            scope: 'pairing', key: pairing.id, value: JSON.stringify(pairing), expires: null
        });
    }
    getPairing(id: string): unknown {
        const pairing = this.pairings.get(id);
        if (!pairing)
            throw new Error('Pairing not found');
        return {
            id, state: pairing.state, uuid: pairing.remote.uuid, expires: pairing.expires, error: pairing.error
        };
    }
    async cancelPairing(id: string): Promise<void> {
        const pairing = this.pairings.get(id);
        if (!pairing)
            return;
        if (pairing.state === 'active')
            throw new Error('Remove the peer to revoke active trust');
        pairing.state = 'cancelled';
        this.invitations.delete(id);
        await this.savePairing(pairing);
        await FederationRecord.destroy({ where: { scope: 'invitation', key: id } });
    }
    async removePeer(alias: string, purge = false): Promise<void> {
        const peer = this.oblecto.config.federation.servers[alias];
        if (!peer)
            throw new Error('Peer not found');
        for (const pairing of this.pairings.values())
            if (pairing.remote.uuid === peer.uuid) {
                pairing.state = 'cancelled';
                await this.savePairing(pairing);
            }
        await this.configure(draft => {
            delete draft.federation.servers[alias];
            if (peer.uuid)
                delete draft.federation.clients[peer.uuid];
        });
        if (purge)
            await File.sequelize!.transaction(async (transaction) => {
                for (const file of await File.findAll({ where: { host: alias }, transaction })) {
                    await MovieFiles.destroy({ where: { FileId: file.id }, transaction });
                    await EpisodeFiles.destroy({ where: { FileId: file.id }, transaction });
                    await file.destroy({ transaction });
                }
            });
    }
    private async stopWorker(alias: string, worker: Worker): Promise<void> {
        worker.stopped = true;
        clearTimeout(worker.timer);
        worker.rpc?.close();
        await worker.task;
        this.workers.delete(alias);
        for (const session of this.oblecto.playback.sessions.values())
            if (session.remote && session.file.host === alias)
                await this.oblecto.playback.stop(session);
    }
    private async closeListeners(): Promise<void> {
        for (const socket of this.sockets)
            socket.destroy();
        for (const socket of this.rawSockets)
            socket.destroy();
        const servers = this.servers;
        this.servers = [];
        await Promise.all(servers.map(server => new Promise<void>(resolve => { server.close(() => resolve()); })));
    }
    async close(): Promise<void> {
        this.stopped = true;
        clearInterval(this.cleanup);
        await this.tail;
        for (const [alias, worker] of this.workers)
            await this.stopWorker(alias, worker);
        await this.closeListeners();
        while (this.tasks.size)
            await Promise.allSettled([...this.tasks]);
    }
}
