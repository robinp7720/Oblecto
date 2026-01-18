import auth from './auth';
import episodes from './episodes';
import streaming from './streaming';
import movies from './movies';
import tvshows from './tvshows';
import users from './users';
import web from './web';
import sets from './sets';
import clients from './clients';
import files from './files';

// V1 Routes
import v1Settings from './v1/settings';
import v1Libraries from './v1/libraries';
import v1System from './v1/system';

/**
 * @param {Server} server
 * @param {Oblecto} oblecto
 */
export default (server, oblecto) => {
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
