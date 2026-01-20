import auth from './auth.js';
import episodes from './episodes.js';
import streaming from './streaming.js';
import movies from './movies.js';
import tvshows from './tvshows.js';
import users from './users.js';
import web from './web.js';
import sets from './sets.js';
import clients from './clients.js';
import files from './files.js';

// V1 Routes
import v1Settings from './v1/settings.js';
import v1Libraries from './v1/libraries.js';
import v1System from './v1/system.js';

import { Express } from 'express';
import Oblecto from '../../../lib/oblecto/index.js';

export default (server: Express, oblecto: Oblecto): void => {
    if (oblecto.config.web.enabled) {
        web(server, oblecto);
    }

    auth(server, oblecto);
    episodes(server, oblecto);
    streaming(server, oblecto);
    files(server, oblecto);
    movies(server, oblecto);
    tvshows(server, oblecto);
    users(server, oblecto);
    sets(server, oblecto);
    clients(server, oblecto);

    // Initialize V1 Routes
    v1Settings(server, oblecto);
    v1Libraries(server, oblecto);
    v1System(server, oblecto);
};
