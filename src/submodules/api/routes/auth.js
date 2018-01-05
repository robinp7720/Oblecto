import jwt from "jsonwebtoken";

import databases from "../../../submodules/database";
import config from "../../../config";

export default (server) => {
    server.post('/auth/login', function (req, res, next) {
        // TODO: Implement password hashing
        databases.user.findOne({where: {username: req.params.username}, attributes: ['username', 'name', 'email', 'id']}).then(user => {
            let token = jwt.sign(user.toJSON(), config.authentication.secret);
            user['access_token'] = token;
            res.send(user);
            next();
        })
    });

    server.get('/auth/isAuthenticated', function (req, res, next) {
        if (req.authorization === undefined)
            return res.send([false]);

        jwt.verify(req.authorization.credentials, config.authentication.secret, function (err, decoded) {
            if (err)
                res.send([false]);
            else
                res.send([true]);
            next();
        });
    });
};