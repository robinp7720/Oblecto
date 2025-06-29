import errors from '../errors';
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

    server.delete('/user/:id', authMiddleWare.requiresAuth, async function (req, res) {
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

        if (req.combined_params.username) {
            user.username = req.combined_params.username;
        }

        if (req.combined_params.password) {
            user.password = await bcrypt.hash(req.combined_params.password, config.authentication.saltRounds);
        }

        if (req.combined_params.email) {
            user.email = req.combined_params.email;
        }

        if (req.combined_params.name) {
            user.name = req.combined_params.name;
        }

        await user.save();

        res.send({
            username: user.username,
            email: user.email,
            name: user.name
        });
    });

    server.post('/user', authMiddleWare.requiresAuth, async function (req, res) {
        // Make sure the required input fields are present, and if not send a bad request error with the associated information to the error

        if (!req.combined_params.username)
            return new errors.BadRequestError('Username is missing');

        if (!req.combined_params.email)
            return new errors.BadRequestError('E-Mail is missing');
        if (!req.combined_params.name)
            return new errors.BadRequestError('Name is missing');

        let passwordHash;

        if (req.combined_params.password)
            passwordHash = await bcrypt.hash(req.combined_params.password, oblecto.config.authentication.saltRounds);

        let [user] = await User.findOrCreate({
            where: { username: req.combined_params.username },
            defaults: {
                name: req.combined_params.name,
                email: req.combined_params.email,
                password: passwordHash
            }
        });

        res.send(user);
    });

};
