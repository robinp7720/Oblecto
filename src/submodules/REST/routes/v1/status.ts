/* eslint-disable jsdoc/check-tag-names, jsdoc/tag-lines, jsdoc/check-types, @typescript-eslint/no-unused-vars */
import { Express, Request, Response, NextFunction } from 'express';
import authMiddleWare from '../../middleware/auth.js';
import Oblecto from '../../../../lib/oblecto/index.js';
import type { OblectoRequest } from '../../index.js';

export default (server: Express, oblecto: Oblecto) => {

    /**
     * @api {get} /api/v1/status/sessions Get active media sessions
     * @apiName GetSessions
     * @apiGroup Status
     * @apiVersion 1.0.0
     * @apiPermission user
     *
     * @apiSuccess {Object[]} sessions List of active media sessions
     */
    server.get('/api/v1/status/sessions', authMiddleWare.requiresAuth, (req: Request, res: Response) => {
        // Scoped to the caller's own sessions, so no permission is needed.

        const user = (req as OblectoRequest).authorization?.user as { id?: number } | undefined;
        const sessions = oblecto.playback.diagnostics(`user:${user?.id}`);

        res.send(sessions);
    });

    /**
     * @api {get} /api/v1/status/clients Get the caller's connected devices
     * @apiName GetClients
     * @apiGroup Status
     * @apiVersion 1.0.0
     * @apiPermission user
     *
     * @apiSuccess {Object[]} clients List of the authenticated user's connected devices
     */
    server.get('/api/v1/status/clients', authMiddleWare.requiresAuth, (req: Request, res: Response) => {
        // Scoped to the caller: the previous unfiltered listing was an
        // enumeration oracle for other people's devices.
        const user = (req as OblectoRequest).authorization?.user as { id?: number } | undefined;
        const userId = user?.id;

        if (userId === undefined) {
            res.send([]);

            return;
        }

        const clients = oblecto.realTimeController.registry.listFor(userId).map(device => ({
            deviceId: device.deviceId,
            name: device.name,
            capabilities: device.capabilities,
            // Only the id: the JWT payload also carries the name and email,
            // and spreading it here leaked both.
            user: { id: device.userId },
            connectedAt: device.connectedAt,
            state: device.state
        }));

        res.send(clients);
    });

    /**
     * @api {get} /api/v1/status/seedbox Get seedbox importer status
     * @apiName GetSeedboxStatus
     * @apiGroup Status
     * @apiVersion 1.0.0
     * @apiPermission system.manage
     *
     * @apiSuccess {Object} status Seedbox status object
     */
    server.get('/api/v1/status/seedbox', authMiddleWare.requiresPermission('system.manage'), (req: Request, res: Response) => {
        const seedboxes = oblecto.seedboxController.seedBoxes.map(sb => ({
            name: sb.name,
            // We can't access enabled state easily from the instance as it's not stored on the class, 
            // but we know these are the loaded ones.
            // moviePath: sb.moviePath, // path might be sensitive? usually internal docker path so maybe ok.
            // seriesPath: sb.seriesPath
        }));

        const queueStats = oblecto.seedboxController.importQueue.getStats();

        res.send({
            seedboxes,
            queue: queueStats
        });
    });
};
