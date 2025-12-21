import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
    { ignores: ['dist/', 'Oblecto-Web/', 'logs/', 'images/', '.idea/', 'coverage/'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    jsdoc.configs['flat/recommended'],
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.es2021
            }
        },
        settings: { jsdoc: { mode: 'typescript' } },
        rules: {
            'indent': ['error', 4, { 'SwitchCase': 1 }],
            'linebreak-style': ['error', 'unix'],
            'quotes': ['error', 'single', { 'avoidEscape': true }],
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
            ],
            
            // Adjustments for the codebase state
            '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
            'no-undef': 'error' // Ensure global variable usage is checked
        }
    },
    {
        files: ['tests/**'],
        languageOptions: { globals: { ...globals.mocha } },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            'no-undef': 'off' // Mocha globals might still trigger if not fully covered, but globals.mocha should help
        }
    },
    {
        files: ['webpack.config.js', '.mocharc.js', 'src/bin/scripts/**/*.js'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-var-requires': 'off'
        }
    }
);
