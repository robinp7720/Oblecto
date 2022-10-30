module.exports = {
    'env': {
        'node': true,
        'es6': true
    },
    'extends': [
        'plugin:jsdoc/recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    'parserOptions': {
        'sourceType': 'module',
        'ecmaVersion': 2020,
    },
    'settings': { 'jsdoc': { 'mode': 'typescript' } },
    'plugins': ['jsdoc', '@typescript-eslint'],
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
