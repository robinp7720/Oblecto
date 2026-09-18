module.exports = {
    diff: true,
    extension: ['ts'],
    spec: ['tests/mocha'],
    package: './package.json',
    import: ['tsx'],
    'watch-files': ['src/**/*.ts', 'tests/mocha/**/*.ts'],
};
