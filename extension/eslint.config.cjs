'use strict';

const js = require('@eslint/js');
const google = require('eslint-config-google');
const globals = require('globals');

const googleRules = {...google.rules};
delete googleRules['require-jsdoc'];
delete googleRules['valid-jsdoc'];

module.exports = [
  {
    name: 'project/ignores',
    ignores: [
      '**/build/**',
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/vendor/**',
    ],
  },
  {
    name: 'project/extension',
    files: [
      'src/chromium/**/*.js',
      'src/firefox/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2017,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...globals.es2015,
        chrome: 'writable',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...googleRules,

      // Preserve the ESLint 7 recommended-rule contract. Evaluate newer
      // correctness rules separately from this tooling-only migration.
      'no-loss-of-precision': 'off',
      'no-nonoctal-decimal-escape': 'off',
      'no-unsafe-optional-chaining': 'off',
      'no-useless-backreference': 'off',
      'no-constant-binary-expression': 'off',
      'no-empty-static-block': 'off',
      'no-new-native-nonconstructor': 'off',
      'no-unused-private-class-members': 'off',
      'no-unassigned-vars': 'off',
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
      'no-inner-declarations': 'error',

      strict: ['error', 'global'],
      'no-console': 'off',
      'no-unused-vars': ['error', {
        args: 'none',
        caughtErrors: 'none',
      }],
      'padded-blocks': 'off',
      'max-len': ['error', 100, 2, {
        ignoreUrls: true,
        ignoreComments: false,
        ignoreRegExpLiterals: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      }],
    },
  },
  {
    // First lint coverage for browser-neutral modules: correctness rules only.
    // Do not reformat existing shared sources to adopt browser UI style rules.
    name: 'project/shared',
    files: ['src/shared/**/*.js'],
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.es2015,
        globalThis: 'readonly',
        module: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', {args: 'none', caughtErrors: 'none'}],
    },
  },
  {
    name: 'project/shared-input-validation',
    files: [
      'src/shared/configuration-transfer.js',
      'src/shared/provider-dataset.js',
    ],
    // These validators deliberately reject control characters in untrusted strings.
    rules: {'no-control-regex': 'off'},
  },
  {
    name: 'project/firefox-runtime-compatibility',
    files: ['src/firefox/background/**/*.js'],
    languageOptions: {
      globals: {
        globalThis: 'readonly',
        module: 'readonly',
      },
    },
  },
  {
    name: 'project/extension-node-tests',
    files: [
      'src/chromium/test/**/*.js',
      'src/firefox/test/**/*.js',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        Crypto: 'off',
      },
    },
  },
  {
    name: 'project/extension-mocha-tests',
    files: [
      'src/chromium/test/**/*.js',
      'src/firefox/test/**/*.test.js',
    ],
    ignores: [
      'src/chromium/test/background-modules.js',
      'src/chromium/test/generate-action-icons.js',
      'src/chromium/test/runtime-performance-harness.js',
      'src/chromium/test/verify-runtime-icons.js',
    ],
    languageOptions: {
      globals: globals.mocha,
    },
  },
];
