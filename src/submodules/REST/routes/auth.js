import jwt from 'jsonwebtoken';
import errors from '../errors';
import bcrypt from 'bcrypt';
import { User } from '../../../models/user';

export default (server, oblecto) => {
    server.post('/auth/login', async function (req, res, next) {
        try {
            if (!req.body.username)
                throw new errors.BadRequestError('Username is missing');
            if (!req.body.password && !oblecto.config.authentication.allowPasswordlessLogin)
                throw new errors.BadRequestError('Password is missing');

            let user = await User.findOne({
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

            let tokenPayload = {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email
            };

            let accessToken = jwt.sign(tokenPayload, oblecto.config.authentication.secret);

            res.send({ accessToken });
        } catch (error) {
            next(error);
        }
    });
};
