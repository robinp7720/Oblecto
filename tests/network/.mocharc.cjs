const path = require('node:path');

// Opt-in suite that calls the real TMDb and TVDB APIs; not part of npm test.
process.env.OBLECTO_CONFIG_PATH = path.join(__dirname, '../fixtures/config.json');

module.exports = {
    extension: ['ts'],
    spec: [path.join(__dirname, '*.spec.ts')],
    import: ['tsx'],
    timeout: 100000
};
