import jwt from 'jsonwebtoken';
import { Express, Request, Response, NextFunction } from 'express';
import errors from '../errors.js';
import bcrypt from 'bcrypt';
import { User } from '../../../models/user.js';

export default (server: Express, oblecto: any) => {
    server.post('/auth/login', async function (req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.body.username)
                throw new errors.BadRequestError('Username is missing');
            if (!req.body.password && !oblecto.config.authentication.allowPasswordlessLogin)
                throw new errors.BadRequestError('Password is missing');

            const user = await User.findOne({
                where: { username: req.body.username },
                attributes: ['username', 'name', 'email', 'password', 'id']
            });

            // Don't send a token if the user doesn't exist
            if (!user)
                throw new errors.UnauthorizedError('Username is incorrect');

            let allowLogin = oblecto.config.authentication.allowPasswordlessLogin;

            if (user.password)
                allowLogin = await bcrypt.compare(req.body.password, user.password);

            if (!allowLogin)
                throw new errors.UnauthorizedError('Password is incorrect');

            const tokenPayload = {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email
            };

            const accessToken = jwt.sign(tokenPayload, oblecto.config.authentication.secret);

            res.send({ accessToken });
        } catch (error) {
            next(error);
        }
    });
};
