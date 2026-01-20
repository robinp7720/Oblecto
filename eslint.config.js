import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
    { ignores: ['dist/', 'Oblecto-Web/', 'logs/', 'images/', '.idea/', 'coverage/'] },
    js.configs.recommended,

    // Type-aware TypeScript linting for .ts files
    ...tseslint.configs.recommendedTypeChecked,

    // TypeScript-aware JSDoc config (doesn't require redundant type annotations)
    jsdoc.configs['flat/recommended-typescript'],

    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.es2021
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            }
        },
        settings: {
            jsdoc: {
                mode: 'typescript',
                // Don't require @param/@returns when TypeScript types already define them
                ignorePrivate: true,
            }
        },
        rules: {
            'spaced-comment': ['error', 'always'],
            'no-multiple-empty-lines': ['error', { 'max': 1 }],
            'object-property-newline': ['error', { 'allowAllPropertiesOnSameLine': true }],
            'object-curly-newline': [
                'error', {
                    'ObjectExpression': { 'minProperties': 3, 'multiline': true },
                    'ObjectPattern': { 'multiline': true },
                    'ImportDeclaration': 'never',
                    'ExportDeclaration': { 'multiline': true, 'minProperties': 3 }
                }
            ],
            'array-bracket-newline': ['error', { 'multiline': true }],

            '@typescript-eslint/no-unused-vars': ['warn', {
                'argsIgnorePattern': '^_',
                'varsIgnorePattern': '^_',
                'caughtErrorsIgnorePattern': '^_'
            }
],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/explicit-function-return-type': ['warn', {
                'allowExpressions': true,
                'allowTypedFunctionExpressions': true,
                'allowHigherOrderFunctions': true
            }
],
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/require-await': 'warn',
            '@typescript-eslint/no-unnecessary-type-assertion': 'error',
            '@typescript-eslint/prefer-nullish-coalescing': 'warn',
            '@typescript-eslint/prefer-optional-chain': 'warn',
            '@typescript-eslint/strict-boolean-expressions': ['warn', {
                'allowString': true,
                'allowNumber': true,
                'allowNullableObject': true
            }],

            // JSDoc rules - focus on documentation quality, not type duplication
            'jsdoc/require-jsdoc': 'off', // Don't force JSDoc everywhere
            'jsdoc/require-param': 'off', // TypeScript params are sufficient
            'jsdoc/require-returns': 'off', // TypeScript return types are sufficient
            'jsdoc/require-param-type': 'off', // TypeScript has the types
            'jsdoc/require-returns-type': 'off', // TypeScript has the types

            // Disable base ESLint rules that are better handled by TypeScript variants
            'no-undef': 'off', // TypeScript handles this
            'no-unused-vars': 'off', // Use @typescript-eslint/no-unused-vars instead
            'no-redeclare': 'off', // TypeScript handles this
            'no-use-before-define': 'off', // TypeScript handles this
        }
    },

    // Special config for TypeScript files to enable type-checking
    {
        files: ['**/*.ts'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            }
        }
    },

    // Test files
    {
        files: ['tests/**'],
        languageOptions: { globals: { ...globals.mocha } },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' in tests
            '@typescript-eslint/explicit-function-return-type': 'off'
        }
    },

    // JavaScript config files (no type-checking needed)
    {
        files: ['**/*.js'],
        ...tseslint.configs.disableTypeChecked,
    },

    // Legacy JS files
    {
        files: ['webpack.config.js', '.mocharc.js', 'src/bin/scripts/**/*.js'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-var-requires': 'off'
        }
    }
);
