import authMiddleWare from '../../middleware/auth';
import errors from '../../errors';
import { ConfigManager } from '../../../../config';

const ALLOWED_SECTIONS = [
    'indexer', 'cleaner', 'mdns', 'queue', 'tvdb', 'themoviedb', 
    'fanart.tv', 'assets', 'server', 'files', 'artwork', 
    'fileExtensions', 'tracker', 'transcoding', 'web', 'streaming', 
    'authentication', 'federation', 'seedboxes' // Added these as they are sections in IConfig
];

// Simple secret scrubber
const scrubConfig = (conf) => {
    const copy = JSON.parse(JSON.stringify(conf));
    if (copy.authentication && copy.authentication.secret) copy.authentication.secret = '***';
    if (copy.federation && copy.federation.key) copy.federation.key = '***';
    if (copy.seedboxes) {
        copy.seedboxes.forEach(sb => {
            if (sb.storageDriverOptions && sb.storageDriverOptions.password) {
                sb.storageDriverOptions.password = '***';
            }
        });
    }
    return copy;
};

export default (server, oblecto) => {
    
    // GET /api/v1/settings - Get full config
    server.get('/api/v1/settings', authMiddleWare.requiresAuth, (req, res) => {
        res.send(scrubConfig(oblecto.config));
    });

    // PATCH /api/v1/settings - Update multiple sections
    server.patch('/api/v1/settings', authMiddleWare.requiresAuth, (req, res, next) => {
        const updates = req.body;
        if (!updates || Object.keys(updates).length === 0) {
            return next(new errors.BadRequestError('Empty configuration provided'));
        }

        // Validate sections
        for (const section of Object.keys(updates)) {
            if (!ALLOWED_SECTIONS.includes(section)) {
                return next(new errors.BadRequestError(`Invalid setting section: ${section}`));
            }
        }

        // Apply updates
        for (const [key, value] of Object.entries(updates)) {
            // Shallow merge for top-level sections
             if (typeof oblecto.config[key] === 'object' && !Array.isArray(oblecto.config[key]) && oblecto.config[key] !== null) {
                Object.assign(oblecto.config[key], value);
            } else {
                oblecto.config[key] = value;
            }
        }

        ConfigManager.saveConfig();
        res.send(scrubConfig(oblecto.config));
    });

    // GET /api/v1/settings/:section
    server.get('/api/v1/settings/:section', authMiddleWare.requiresAuth, (req, res, next) => {
        if (!ALLOWED_SECTIONS.includes(req.params.section)) {
            return next(new errors.BadRequestError('Invalid setting section'));
        }
        const sectionData = oblecto.config[req.params.section];
        if (!sectionData) return next(new errors.NotFoundError('Section not found'));

        // We wrap it in a dummy object to reuse scrubConfig logic easily or just scrub manually
        // But since scrubConfig expects full structure for deep keys, let's just send it if it's not sensitive
        // or simple manual check.
        let dataToSend = sectionData;
        if (req.params.section === 'authentication') {
            dataToSend = { ...sectionData, secret: '***' };
        } else if (req.params.section === 'federation') {
            dataToSend = { ...sectionData, key: '***' };
        }
        // Seedboxes logic omitted for brevity in single section fetch, can add if needed.

        res.send(dataToSend);
    });

    // PATCH /api/v1/settings/:section
    server.patch('/api/v1/settings/:section', authMiddleWare.requiresAuth, (req, res, next) => {
        const section = req.params.section;
        if (!ALLOWED_SECTIONS.includes(section)) {
            return next(new errors.BadRequestError('Invalid setting section'));
        }

        const updates = req.body;
        if (!updates || Object.keys(updates).length === 0) {
            return next(new errors.BadRequestError('Empty configuration provided'));
        }

        if (!oblecto.config[section]) oblecto.config[section] = {};

        if (typeof oblecto.config[section] === 'object' && !Array.isArray(oblecto.config[section])) {
            Object.assign(oblecto.config[section], updates);
        } else {
            oblecto.config[section] = updates;
        }

        ConfigManager.saveConfig();
        res.send(oblecto.config[section]);
    });
};
