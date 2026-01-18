import authMiddleWare from '../../middleware/auth';
import errors from '../../errors';
import { ConfigManager } from '../../../../config';

const ALLOWED_LIBRARIES = ['movies', 'tvshows'];

export default (server, oblecto) => {
    
    // GET /api/v1/libraries
    server.get('/api/v1/libraries', authMiddleWare.requiresAuth, (req, res) => {
        const libs = {};
        ALLOWED_LIBRARIES.forEach(lib => {
            libs[lib] = oblecto.config[lib];
        });
        res.send(libs);
    });

    // GET /api/v1/libraries/:type
    server.get('/api/v1/libraries/:type', authMiddleWare.requiresAuth, (req, res, next) => {
        if (!ALLOWED_LIBRARIES.includes(req.params.type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }
        res.send(oblecto.config[req.params.type].directories || []);
    });

    // PATCH /api/v1/libraries/:type - Update general library settings (identifiers, updaters, etc)
    server.patch('/api/v1/libraries/:type', authMiddleWare.requiresAuth, (req, res, next) => {
        const type = req.params.type;
        if (!ALLOWED_LIBRARIES.includes(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }
        
        const updates = req.body;
        if (!updates || Object.keys(updates).length === 0) {
            return next(new errors.BadRequestError('Empty configuration provided'));
        }

        Object.assign(oblecto.config[type], updates);
        ConfigManager.saveConfig();

        res.send(oblecto.config[type]);
    });

    // POST /api/v1/libraries/:type/paths - Add a source directory
    server.post('/api/v1/libraries/:type/paths', authMiddleWare.requiresAuth, (req, res, next) => {
        const type = req.params.type;
        if (!ALLOWED_LIBRARIES.includes(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }

        const { path } = req.body;
        if (!path) {
            return next(new errors.BadRequestError('Path is required'));
        }

        if (!oblecto.config[type].directories) oblecto.config[type].directories = [];

        // Check for duplicates
        if (oblecto.config[type].directories.some(d => d.path === path)) {
             return next(new errors.ConflictError('Path already exists'));
        }

        oblecto.config[type].directories.push({ path });
        ConfigManager.saveConfig();

        res.send(oblecto.config[type].directories);
    });

    // DELETE /api/v1/libraries/:type/paths - Remove a source directory
    server.delete('/api/v1/libraries/:type/paths', authMiddleWare.requiresAuth, (req, res, next) => {
        const type = req.params.type;
        if (!ALLOWED_LIBRARIES.includes(type)) {
            return next(new errors.BadRequestError('Invalid library type'));
        }

        const { path } = req.body;
        if (!path) {
            return next(new errors.BadRequestError('Path is required'));
        }

        const index = oblecto.config[type].directories.findIndex(d => d.path === path);
        if (index === -1) {
            return next(new errors.NotFoundError('Path not found'));
        }

        oblecto.config[type].directories.splice(index, 1);
        ConfigManager.saveConfig();

        res.send(oblecto.config[type].directories);
    });
};
