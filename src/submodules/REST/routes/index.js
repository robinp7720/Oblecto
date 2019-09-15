import auth from './auth';
import episodes from './episodes';
import files from './files';
import movies from './movies';
import tvshows from './tvshows';
import settings from './settings';
import users from './users';
import web from './web';
import sets from './sets';

import config from '../../../config';


export default (server) => {
    if (config.web.enabled) {
        web(server);
    }

    auth(server);
    episodes(server);
    files(server);
    movies(server);
    tvshows(server);
    settings(server);
    users(server);
    sets(server);
};
