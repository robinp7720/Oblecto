import type { Express, Request, Response, NextFunction } from 'express';
import auth from '../middleware/auth.js';
import { File } from '../../../models/file.js';
import type Oblecto from '../../../lib/oblecto/index.js';
import type { OblectoRequest } from '../index.js';
import type { PlaybackOptions } from '../../../lib/playback/types.js';
import { PlaybackError } from '../../../lib/playback/types.js';

export const playbackError = (
    error: unknown,
    _req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (res.headersSent) {
        next(error);
        return;
    }
    if (error instanceof PlaybackError) {
        if (error.code === 'SERVER_CAPACITY') res.setHeader('Retry-After', '2');
        res.status(error.statusCode).send({
            code: error.code,
            message: error.message
        });
    } else next(error);
};
export default (server: Express, oblecto: Oblecto): void => {
    const owner = (req: OblectoRequest): string => {
        const id = (req.authorization?.user as { id?: unknown } | undefined)
            ?.id;
        if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0)
            throw new PlaybackError(
                'UNAUTHORIZED',
                'Authentication required',
                401
            );
        return `user:${Number(id)}`;
    };
    const requiresAuth = auth.requiresAuth.bind(auth);
    const body = (
        req: Request
    ): PlaybackOptions & {
        fileId: number;
        revision: number;
        position: number;
        paused?: boolean;
        buffering?: boolean;
    } => {
        if (
            !req.body ||
            typeof req.body !== 'object' ||
            Array.isArray(req.body)
        )
            throw new PlaybackError(
                'INVALID_SELECTION',
                'Expected a JSON object'
            );
        return req.body as PlaybackOptions & {
            fileId: number;
            revision: number;
            position: number;
        };
    };
    server.post(
        '/playback/sessions',
        requiresAuth,
        async (req: OblectoRequest, res) => {
            const identity = owner(req);
            if (
                !Number.isSafeInteger(body(req).fileId) ||
                body(req).fileId <= 0
            )
                throw new PlaybackError('INVALID_SELECTION', 'Invalid fileId');
            const file = await File.findByPk(body(req).fileId);
            if (!file)
                throw new PlaybackError(
                    'MEDIA_NOT_FOUND',
                    'Media file does not exist',
                    404
                );
            const { fileId: _fileId, ...options } = body(req);
            const session = await oblecto.playback.create(
                file,
                identity,
                Number(identity.slice(5)),
                options
            );
            res.status(201).send(oblecto.playback.describe(session));
        }
    );
    server.get(
        '/playback/sessions/:id',
        requiresAuth,
        (req: OblectoRequest, res) => {
            const session = oblecto.playback.get(
                String(req.params.id),
                owner(req)
            );
            res.send(oblecto.playback.describe(session));
        }
    );
    server.patch(
        '/playback/sessions/:id',
        requiresAuth,
        async (req: OblectoRequest, res) => {
            const session = oblecto.playback.get(
                String(req.params.id),
                owner(req)
            );
            const { revision, ...options } = body(req);
            await oblecto.playback.update(session, options, revision);
            res.send(oblecto.playback.describe(session));
        }
    );
    server.post(
        '/playback/sessions/:id/progress',
        requiresAuth,
        async (req: OblectoRequest, res) => {
            const session = oblecto.playback.get(
                String(req.params.id),
                owner(req)
            );
            await oblecto.playback.report(session, body(req));
            res.status(204).end();
        }
    );
    server.delete(
        '/playback/sessions/:id',
        requiresAuth,
        async (req: OblectoRequest, res) => {
            const identity = owner(req);
            const existing = oblecto.playback.sessions.get(
                String(req.params.id)
            );
            if (existing)
                await oblecto.playback.stop(
                    oblecto.playback.get(String(req.params.id), identity)
                );
            res.status(204).end();
        }
    );
    server.get('/playback/media/:id/:revision/:asset', async (req, res) => {
        const session = oblecto.playback.get(String(req.params.id));
        if (
            typeof req.query.token !== 'string' ||
            req.query.token !== session.token
        )
            throw new PlaybackError('UNAUTHORIZED', 'Invalid media token', 401);
        await oblecto.playback.serve(
            session,
            Number(req.params.revision),
            String(req.params.asset),
            req,
            res
        );
    });
    server.use('/playback', playbackError);
};
