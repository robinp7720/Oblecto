import { Express, Request, Response } from 'express';
import errors from '../errors.js';
import bcrypt from 'bcrypt';
import config from '../../../config.js';
import authMiddleWare from '../middleware/auth.js';
import { User } from '../../../models/user.js';

export default (server: Express, oblecto: any) => {
    server.get('/users', async function (req: Request, res: Response) {
        const users = await User.findAll({ attributes: ['username', 'name', 'email', 'id'] });

        res.send(users);
    });

    server.get('/user/:id', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        const user = await User.findOne({
            where: { id: req.params.id },
            attributes: ['username', 'name', 'email', 'id']
        });

        res.send(user);
    });

    server.delete('/user/:id', authMiddleWare.requiresAuth, async function (req: Request, res: Response) {
        const user = await User.findOne({
            where: { id: req.params.id },
            attributes: ['username', 'name', 'email', 'id']
        });

        if (!user) {
            res.status(404).send({ message: 'User not found' });
            return;
        }

        // Send the user information of the user to the client first
        res.send(user);

        // Now delete the user
        await user.destroy();
    });

    // Endpoint to update the entries of a certain user
    server.put('/user/:id', authMiddleWare.requiresAuth,  async function (req: any, res: Response) {
        const user = await User.findByPk(req.params.id);

        if (!user) {
            res.status(400).send({ message: 'User with id does not exist' });
            return;
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

    server.post('/user', authMiddleWare.requiresAuth, async function (req: any, res: Response) {
        if (!req.combined_params.username)
            return res.status(400).send({ message: 'Username is missing' });

        if (!req.combined_params.email)
            return res.status(400).send({ message: 'E-Mail is missing' });
        if (!req.combined_params.name)
            return res.status(400).send({ message: 'Name is missing' });

        let passwordHash: string | undefined;

        if (req.combined_params.password)
            passwordHash = await bcrypt.hash(req.combined_params.password, oblecto.config.authentication.saltRounds);

        const [user] = await User.findOrCreate({
            where: { username: req.combined_params.username },
            defaults: {
                username: req.combined_params.username,
                name: req.combined_params.name,
                email: req.combined_params.email,
                password: passwordHash || null
            }
        });

        res.send(user);
    });

};
