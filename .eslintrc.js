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
    'settings': { 'jsdoc': { 'mode': 'typescript' } },
    'plugins': ['jsdoc'],
    'rules': {
        'indent': ['error', 4, { 'SwitchCase': 1 }],
        'linebreak-style': ['error', 'unix'],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'func-call-spacing': ['error', 'never'],
        'rest-spread-spacing': ['error', 'never'],

        'newline-after-var': ['error', 'always'],

        'lines-around-directive': ['error', 'never'],
        'spaced-comment': ['error', 'always'],
        'no-multiple-empty-lines': ['error', { 'max': 1 }],
        'no-unused-vars': ['error', { 'args': 'none' }],

        'array-bracket-newline': ['error', { 'multiline': true }],
        'array-bracket-spacing': ['error', 'never'],

        'object-property-newline': ['error', { 'allowAllPropertiesOnSameLine': true }],
        'object-curly-spacing': ['error', 'always'],
        'object-curly-newline': [
            'error', {
                'ObjectExpression': { 'minProperties': 3, 'multiline': true },
                'ObjectPattern': { 'multiline': true, },
                'ImportDeclaration': 'never',
                'ExportDeclaration': { 'multiline': true, 'minProperties': 3 }
            }
        ]
    }
};
