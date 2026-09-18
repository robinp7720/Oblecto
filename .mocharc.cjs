const path = require('node:path');

// Specs read their settings from a fixture, never from /etc/oblecto on the machine running them.
process.env.OBLECTO_CONFIG_PATH = path.join(__dirname, 'tests/fixtures/config.json');

module.exports = {
    diff: true,
    extension: ['ts'],
    spec: ['tests/mocha'],
    package: './package.json',
    import: ['tsx'],
    'watch-files': ['src/**/*.ts', 'tests/mocha/**/*.ts'],
};
