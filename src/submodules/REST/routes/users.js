import errors from 'restify-errors';
import bcrypt from 'bcrypt';

import config from '../../../config';
import authMiddleWare from '../middleware/auth';

import { User } from '../../../models/user';

export default (server, oblecto) => {
    server.get('/users', async function (req, res) {
        let users = await User.findAll({ attributes: ['username', 'name', 'email', 'id'] });

        res.send(users);
    });

    server.get('/user/:id', authMiddleWare.requiresAuth, async function (req, res) {
        let user = await User.findOne({
            where: { id: req.params.id },
            attributes: ['username', 'name', 'email', 'id']
        });

        res.send(user);
    });

    server.del('/user/:id', authMiddleWare.requiresAuth, async function (req, res) {
        let user = await User.findOne({
            where: { id: req.params.id },
            attributes: ['username', 'name', 'email', 'id']
        });

        // Send the user information of the user to the client first
        res.send(user);

        // Now delete the user
        await user.destroy();
    });

    // Endpoint to update the entries of a certain user
    server.put('/user/:id', authMiddleWare.requiresAuth,  async function (req, res) {
        let user = await User.findByPk(req.params.id);

        if (!user) {
            return new errors.BadRequestError('User with id does not exist');
        }

        if (req.params.username) {
            user.update({ username: req.params.username, });
        }

        if (req.params.password) {
            user.update({ password: await bcrypt.hash(req.params.password, config.authentication.saltRounds) });
        }

        if (req.params.email) {
            user.update({ email: req.params.email });
        }

        if (req.params.name) {
            user.update({ name: req.params.name });
        }
    });

    server.post('/user', authMiddleWare.requiresAuth, async function (req, res) {
        // Make sure the required input fields are present, and if not send a bad request error with the associated information to the error

        if (!req.params.username)
            return new errors.BadRequestError('Username is missing');

        if (!req.params.email)
            return new errors.BadRequestError('E-Mail is missing');
        if (!req.params.name)
            return new errors.BadRequestError('Name is missing');

        let passwordHash;

        if (req.params.password)
            passwordHash = await bcrypt.hash(req.params.password, oblecto.config.authentication.saltRounds);

        let [user] = await User.findOrCreate({
            where: { username: req.params.username },
            defaults: {
                name: req.params.name,
                email: req.params.email,
                password: passwordHash
            }
        });

        res.send(user);
    });

};
