import jwt from "jsonwebtoken";
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

};