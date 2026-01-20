/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/unbound-method, @typescript-eslint/prefer-nullish-coalescing */
import { Express, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import config from '../../../config.js';
import authMiddleWare from '../middleware/auth.js';
import { User } from '../../../models/user.js';
import Oblecto from '../../../lib/oblecto/index.js';
import { OblectoRequest } from '../index.js';

export default (server: Express, oblecto: Oblecto) => {
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
    server.put('/user/:id', authMiddleWare.requiresAuth,  async function (req: OblectoRequest, res: Response) {
        const user = await User.findByPk(req.params.id);

        if (!user) {
            res.status(400).send({ message: 'User with id does not exist' });
            return;
        }

        const params = req.combined_params!;

        if (params.username) {
            user.username = params.username as string;
        }

        if (params.password) {
            user.password = await bcrypt.hash(params.password as string, config.authentication.saltRounds);
        }

        if (params.email) {
            user.email = params.email as string;
        }

        if (params.name) {
            user.name = params.name as string;
        }

        await user.save();

        res.send({
            username: user.username,
            email: user.email,
            name: user.name
        });
    });

    server.post('/user', authMiddleWare.requiresAuth, async function (req: OblectoRequest, res: Response) {
        const params = req.combined_params!;

        if (!params.username)
            return res.status(400).send({ message: 'Username is missing' });

        if (!params.email)
            return res.status(400).send({ message: 'E-Mail is missing' });
        if (!params.name)
            return res.status(400).send({ message: 'Name is missing' });

        let passwordHash: string | undefined;

        if (params.password)
            passwordHash = await bcrypt.hash(params.password as string, oblecto.config.authentication.saltRounds);

        const [user] = await User.findOrCreate({
            where: { username: params.username },
            defaults: {
                username: params.username as string,
                name: params.name as string,
                email: params.email as string,
                password: passwordHash || null
            }
        });

        res.send(user);
    });

};