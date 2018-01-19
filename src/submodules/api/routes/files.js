import jwt from "jsonwebtoken";
import sequelize from "sequelize";

import config from "../../../config";
import databases from "../../../submodules/database";

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

    // Endpoint to get the files currently being watched
    server.get('/watching', requiresAuth, function (req, res, next) {
        // search for attributes
        databases.track.findAll({
            include: [
                {
                    model: databases.episode,
                    include: [databases.tvshow]
                }
            ],
            where: {
                userId: req.authorization.jwt.id,
                progress: {[sequelize.Op.lt]: 0.9}
            },
            order: [
                ['updatedAt', 'DESC'],
            ],
        }).then(tracks => {
            res.send(tracks.map((track)=> {
                return track.episode;
            }))
        })
    });
};