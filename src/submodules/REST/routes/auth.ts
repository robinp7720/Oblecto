/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions */
import { issueAccessToken } from '../../../lib/auth/tokens.js';
import { Express, Request, Response, NextFunction } from 'express';
import errors from '../errors.js';
import { User } from '../../../models/user.js';
import { clientAddress, isLocalRequest } from '../../../lib/network/localNetwork.js';
import { loginThrottle } from '../../../lib/auth/loginThrottle.js';
import { HttpError } from '../errors.js';
import { canSignInWithoutPassword, checkLogin } from '../../../lib/auth/loginPolicy.js';

export default (server: Express, oblecto: any) => {
    // What the login screen should offer this client: the profile picker is
    // only ever populated for requests from the local network.
    server.get('/auth/login-options', async function (req: Request, res: Response, next: NextFunction) {
        try {
            const authentication = oblecto.config.authentication;
            const local = isLocalRequest(req, authentication);
            const profilePicker = local && authentication.profilePicker !== false;

            const users = profilePicker
                ? await User.findAll({
                    where: { publicProfile: true },
                    attributes: ['id', 'username', 'name', 'avatar', 'password', 'passwordlessLocal'],
                    order: [['name', 'ASC'], ['username', 'ASC']]
                })
                : [];

            res.send({
                local,
                profilePicker,
                users: users.map(user => ({
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    avatar: user.avatar,
                    passwordless: canSignInWithoutPassword(user, local, authentication)
                }))
            });
        } catch (error) {
            next(error);
        }
    });

    server.post('/auth/login', async function (req: Request, res: Response, next: NextFunction) {
        const authentication = oblecto.config.authentication;
        const address = clientAddress(req, authentication);
        const account = req.body?.username ? String(req.body.username) : `id:${String(req.body?.userId)}`;

        try {
            const wait = loginThrottle.retryAfter(address, account);

            if (wait > 0) {
                res.set('Retry-After', String(wait));
                throw new HttpError(429, `Too many failed sign-ins. Try again in ${Math.ceil(wait / 60)} minutes.`);
            }

            const local = isLocalRequest(req, authentication);
            const userId = Number(req.body.userId);

            if (!req.body.username && !Number.isInteger(userId))
                throw new errors.BadRequestError('Username is missing');

            const user = await User.findOne({
                where: req.body.username ? { username: req.body.username } : { id: userId },
                attributes: ['username', 'name', 'email', 'password', 'passwordlessLocal', 'id']
            });

            // Don't send a token if the user doesn't exist
            if (!user)
                throw new errors.UnauthorizedError('Username is incorrect');

            if (!req.body.password && !canSignInWithoutPassword(user, local, authentication))
                throw new errors.BadRequestError('Password is missing');

            if (!await checkLogin(user, req.body.password, local, authentication))
                throw new errors.UnauthorizedError('Password is incorrect');

            const accessToken = issueAccessToken(user, authentication);

            loginThrottle.succeeded(address, account);
            res.send({ accessToken });
        } catch (error) {
            if (error instanceof HttpError && error.statusCode === 401) loginThrottle.failed(address, account);
            next(error);
        }
    });
};
