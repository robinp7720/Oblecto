import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import authMiddleware from '../../src/submodules/REST/middleware/auth.js';
import config from '../../src/config.js';
import type { OblectoRequest } from '../../src/submodules/REST/index.js';

const makeReq = (overrides: Partial<OblectoRequest> = {}): OblectoRequest => ({
    ...overrides
} as OblectoRequest);

describe('Auth middleware', () => {
    describe('requiresAuth', () => {
        it('rejects a request with no authorization header parsed', (done) => {
            const req = makeReq();

            authMiddleware.requiresAuth(req, {} as any, (err?: any) => {
                assert.ok(err);
                assert.equal(err.statusCode, 401);
                done();
            });
        });

        it('calls next with no error and attaches decoded payload for a valid token', (done) => {
            const token = jwt.sign({ id: 42, username: 'robin' }, config.authentication.secret);
            const req = makeReq({ authorization: { scheme: 'Bearer', credentials: token } });

            authMiddleware.requiresAuth(req, {} as any, (err?: any) => {
                assert.equal(err, undefined);
                assert.equal(req.authorization?.user.id, 42);
                assert.equal(req.authorization?.user.username, 'robin');
                done();
            });
        });

        it('rejects a token signed with the wrong secret', (done) => {
            const token = jwt.sign({ id: 1 }, 'not-the-real-secret');
            const req = makeReq({ authorization: { scheme: 'Bearer', credentials: token } });

            authMiddleware.requiresAuth(req, {} as any, (err?: any) => {
                assert.ok(err);
                assert.equal(err.statusCode, 401);
                done();
            });
        });

        it('rejects a malformed token', (done) => {
            const req = makeReq({ authorization: { scheme: 'Bearer', credentials: 'not-a-real-jwt' } });

            authMiddleware.requiresAuth(req, {} as any, (err?: any) => {
                assert.ok(err);
                assert.equal(err.statusCode, 401);
                done();
            });
        });

        it('rejects an expired token', (done) => {
            const token = jwt.sign({ id: 1 }, config.authentication.secret, { expiresIn: -10 });
            const req = makeReq({ authorization: { scheme: 'Bearer', credentials: token } });

            authMiddleware.requiresAuth(req, {} as any, (err?: any) => {
                assert.ok(err);
                assert.equal(err.statusCode, 401);
                done();
            });
        });

        it('falls back to combined_params.auth when no bearer credentials are present', (done) => {
            const token = jwt.sign({ id: 7 }, config.authentication.secret);
            const req = makeReq({
                authorization: { scheme: '', credentials: '' },
                combined_params: { auth: token }
            });

            authMiddleware.requiresAuth(req, {} as any, (err?: any) => {
                assert.equal(err, undefined);
                assert.equal(req.authorization?.user.id, 7);
                done();
            });
        });
    });
});
