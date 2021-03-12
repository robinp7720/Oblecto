module.exports = {
    'env': {
        'node': true,
        'es6': true
    },
    'extends': [
        'eslint:recommended',
        'plugin:jsdoc/recommended'
    ],
    'parserOptions': {
        'sourceType': 'module',
        'ecmaVersion': 2020,
    },
    'plugins': ['jsdoc'],
    'rules': {
        'indent': ['error', 4, { 'SwitchCase': 1 }],
        'linebreak-style': ['error', 'unix'],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'func-call-spacing': ['error', 'never'],
        'rest-spread-spacing': ['error', 'never'],
        'object-curly-spacing': ['error', 'always'],
        'newline-after-var': ['error', 'always'],
        'array-bracket-newline': ['error', { 'multiline': true }],
        'array-bracket-spacing': ['error', 'never'],
        'lines-around-directive': ['error', 'never'],
        'spaced-comment': ['error', 'always'],
        'no-multiple-empty-lines': ['error', { 'max': 1 }],
        // 'camelcase': ['error', { 'properties': 'always' }],
        'no-unused-vars': ['error', { 'args': 'none' }],
        'object-property-newline': ['error', { 'allowAllPropertiesOnSameLine': true }],
    }
};
