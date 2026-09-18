/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/strict-boolean-expressions */
import jwt from 'jsonwebtoken';
import { Express, Request, Response, NextFunction } from 'express';
import errors from '../errors.js';
import { User } from '../../../models/user.js';
import { isLocalRequest } from '../../../lib/network/localNetwork.js';
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
        try {
            const authentication = oblecto.config.authentication;
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

            const tokenPayload = {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email
            };

            const accessToken = jwt.sign(tokenPayload, authentication.secret);

            res.send({ accessToken });
        } catch (error) {
            next(error);
        }
    });
};
