import auth from './auth';
import episodes from './episodes';
import streaming from './streaming';
import movies from './movies';
import tvshows from './tvshows';
import settings from './settings';
import users from './users';
import web from './web';
import sets from './sets';
import clients from './clients';

import config from '../../../config';


export default (server, oblecto) => {
    if (config.web.enabled) {
        web(server, oblecto);
    }

    auth(server, oblecto);
    episodes(server, oblecto);
    streaming(server, oblecto);
    files(server, oblecto);
    movies(server, oblecto);
    tvshows(server, oblecto);
    settings(server, oblecto);
    users(server, oblecto);
    sets(server, oblecto);
    clients(server, oblecto);
};
