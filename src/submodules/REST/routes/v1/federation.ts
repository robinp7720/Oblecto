import { safeError } from '../../../../lib/federation/FederationService.js';
import type { Express, Request, Response, NextFunction } from 'express';
import type Oblecto from '../../../../lib/oblecto/index.js';
import auth from '../../middleware/auth.js';
import { record, text } from '../../../../lib/federation/protocol.js';
import { validateFederation } from '../../../../lib/federation/validation.js';

export default function federationRoutes(server: Express, oblecto: Oblecto): void {
    const base = '/api/v1/federation';
    const permission = auth.requiresPermission('settings.manage');
    const route = (handler: (req: Request, res: Response) => unknown) => (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve().then(() => handler(req, res)).catch((error: unknown) => {
            next(Object.assign(new Error(safeError(error)), { statusCode: 400 }));
        });
    };
    server.get(`${base}/status`, permission, route((_req, res) => res.send(oblecto.federation.status())));
    server.get(`${base}/identity`, permission, route(async (_req, res) => res.send(await oblecto.federation.getIdentity())));
    server.post(`${base}/identity`, permission, route(async (req, res) => res.send(await oblecto.federation.setup(text(record(req.body).address, 253)))));
    server.post(`${base}/invitations`, permission, route(async (_req, res) => res.status(201).send(await oblecto.federation.invitation())));
    server.delete(`${base}/invitations/:id`, permission, route(async (req, res) => { await oblecto.federation.revokeInvitation(String(req.params.id)); res.sendStatus(204); }));
    server.post(`${base}/pairings`, permission, route(async (req, res) => res.status(202).send({ operationId: await oblecto.federation.pair(text(record(req.body).invitation, 48000)) })));
    server.get(`${base}/pairings/:id`, permission, route((req, res) => res.send(oblecto.federation.getPairing(String(req.params.id)))));
    server.delete(`${base}/pairings/:id`, permission, route(async (req, res) => { await oblecto.federation.cancelPairing(String(req.params.id)); res.sendStatus(204); }));
    server.put(`${base}/peers/:id`, permission, route(async (req, res) => {
        const id = String(req.params.id); const body = record(req.body);
        const fields = validateFederation({ servers: { [id]: body } });
        if (Object.keys(fields).length) return res.status(400).send({ error: 'Check the highlighted settings.', fields });
        await oblecto.federation.configure(draft => { draft.federation.servers[id] = body as typeof draft.federation.servers[string]; });
        res.send(oblecto.federation.status());
    }));
    server.delete(`${base}/peers/:id`, permission, route(async (req, res) => { await oblecto.federation.removePeer(String(req.params.id), req.query.purge === 'true'); res.sendStatus(204); }));
    server.post(`${base}/peers/:id/test`, permission, route(async (req, res) => { await oblecto.federation.test(String(req.params.id)); res.send({ ok: true }); }));
    server.post(`${base}/peers/:id/sync`, permission, route((req, res) => res.status(202).send({ operationId: oblecto.federation.syncNow(String(req.params.id)) })));
    server.post(`${base}/peers/:id/reconnect`, permission, route(async (req, res) => { await oblecto.federation.reconnect(String(req.params.id)); res.send(oblecto.federation.status()); }));
}
