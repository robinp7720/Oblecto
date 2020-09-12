import EmbyServerAPI from './ServerAPI';

import { v4 as uuidv4 } from 'uuid';

export default class EmbyEmulation {
    /**
     *
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;

        this.sessions = {};

        this.serverId = 'cadda85fd4f447b9ad3ccc3c83cf1cf6';

        this.serverAPI = new EmbyServerAPI(this);
    }

    handleLogin(username, password) {
        let sessionToken = uuidv4();

        this.sessions[sessionToken] = {};

        return sessionToken;
    }
}
