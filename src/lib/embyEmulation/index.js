import EmbyServerAPI from './ServerAPI';

import { v4 as uuidv4 } from 'uuid';
import {User} from '../../models/user';
import errors from 'restify-errors';
import bcrypt from 'bcrypt';

export default class EmbyEmulation {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.sessions = {};

        this.serverId = 'cadda85fd4f447b9ad3ccc3c83cf1cf6';
        this.version = '10.6.4';

        this.serverName = 'Oblecto';

        this.serverAPI = new EmbyServerAPI(this);
    }

    async handleLogin(username, password) {
        let user = await User.findOne({
            where: {
                username: username
            },
            attributes: ['username', 'name', 'email', 'password', 'id']
        });

        if (!user) throw Error('Incorrect username');

        if (!await bcrypt.compare(password, user.password))
            throw Error('Password incorrect');

        let HasPassword = user.password !== '';

        let sessionId = uuidv4();

        this.sessions[sessionId] = {
            Name: user.name,
            ServerId: this.serverId,
            Id: user.id,
            HasPassword,
            HasConfiguredPassword: HasPassword,
            HasConfiguredEasyPassword: false,
            EnableAutoLogin: false,
            LastLoginDate: '2020-09-11T23:37:27.3042432Z',
            LastActivityDate: '2020-09-11T23:37:27.3042432Z'
        };

        return sessionId;
    }
}
