import jwt from "jsonwebtoken";
import path from 'path';
import fs from 'fs';

import config from "../../../../config";
import TVShowIndexer from "../../../../lib/indexers/tv/index";
import MovieIndexer from "../../../../lib/indexers/movies/index";

export default (server) => {

    const requiresAuth = function (req, res, next) {
        if (req.authorization === undefined)
            return next(false);

        jwt.verify(req.authorization.credentials, config.authentication.secret, function (err, decoded) {
            if (err)
                return next(false);

            next();
        });
    };

    // API Endpoint to request a re-index of certain library types
    server.get('/settings/maintenance/index/:libraries', requiresAuth, function (req, res, next) {
        switch (req.params.libraries) {
            case "tvshows":
                TVShowIndexer.indexAll();
                break;
            case "movies":
                MovieIndexer.indexAll();
                break;
            case "all":
                TVShowIndexer.indexAll();
                MovieIndexer.indexAll();
                break;
        }

        res.send([true]);
    });

};