import jwt from 'jsonwebtoken';
import errors from 'restify-errors';

import databases from '../../../submodules/database';
import config from '../../../config';
import restify from 'restify'

export default (server) => {
    server.get('/web/*', restify.plugins.serveStatic({
        directory: __dirname + '../../../../../Oblecto-Web/dist/',
        default: 'index.html'
    }));
};