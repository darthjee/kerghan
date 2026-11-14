import js from '@eslint/js';
import complexity from 'eslint-plugin-complexity';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import sortClassMembers from 'eslint-plugin-sort-class-members';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['node_modules/**/*.js', 'coverage/**', 'report/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    plugins: {
      complexity,
      jsdoc,
      'import': importPlugin,
      'sort-class-members': sortClassMembers,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.js', '.mjs'] },
      },
    },
    rules: {
      'import/order': ['error', {
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'never',
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
      }],

      'no-trailing-spaces': ['error', { skipBlankLines: false, ignoreComments: false }],
      'no-multi-spaces': ['error', { ignoreEOLComments: true }],

      complexity: ['warn', { max: 10 }],
      'max-lines': ['warn', { max: 300 }],
      'max-depth': ['warn', { max: 4 }],

      indent: ['error', 2, { SwitchCase: 1 }],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],

      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',

      'sort-class-members/sort-class-members': ['error', {
        order: [
          '[static-properties]',
          '[static-methods]',
          '[properties]',
          'constructor',
          { type: 'method', private: false },
          { type: 'method', private: true },
        ],
        accessorPairPositioning: 'getThenSet',
      }],

      'jsdoc/check-alignment': 'warn',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'warn',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns-description': 'warn',
    },
  },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.ts'] })),
  {
    files: ['**/*.ts'],
    plugins: {
      complexity,
      jsdoc,
      'import': importPlugin,
      'sort-class-members': sortClassMembers,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.ts', '.js'] },
      },
    },
    rules: {
      'import/order': ['error', {
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'never',
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
      }],

      'no-trailing-spaces': ['error', { skipBlankLines: false, ignoreComments: false }],
      'no-multi-spaces': ['error', { ignoreEOLComments: true }],

      complexity: ['warn', { max: 10 }],
      'max-lines': ['warn', { max: 300 }],
      'max-depth': ['warn', { max: 4 }],

      indent: ['error', 2, { SwitchCase: 1 }],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',

      // TypeScript's own compiler (via `strict`/`noImplicitAny`, see
      // tsconfig.json) already catches unused vars/undefined members with
      // more precision than the JS-oriented rules below.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // NestJS decorators (`@Entity()`, `@Column()`, DTO classes, ...) and
      // TypeORM's column typing rely on empty/declaration-only constructs
      // that this rule otherwise flags.
      '@typescript-eslint/no-empty-object-type': 'off',

      'sort-class-members/sort-class-members': ['error', {
        order: [
          '[static-properties]',
          '[static-methods]',
          '[properties]',
          'constructor',
          { type: 'method', private: false },
          { type: 'method', private: true },
        ],
        accessorPairPositioning: 'getThenSet',
      }],

      'jsdoc/check-alignment': 'warn',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'warn',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns-description': 'warn',
    },
  },
  // Repositories module boundary (`docs/agents/specs/repos/security.md#module-boundaries`):
  // deny by default every Integrations / Auth path, except the allowlisted
  // entry points, and never call `fetch` directly. Tests are exempt, so their
  // support code may import the Integrations test fakes.
  {
    files: ['src/repositories/**/*.ts'],
    ignores: ['src/repositories/tests/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '**/integrations/**',
              '!**/integrations/integrations-github.public*',
              '!**/integrations/github-repo-results*',
              '!**/integrations/add-candidate-walk*',
              // gitignore semantics: a file under an excluded directory can only
              // be re-included once its directory is.
              '!**/integrations/events/',
              '**/integrations/events/*',
              '!**/integrations/events/integration-deleted.event*',
            ],
            message: 'Repositories reaches Integrations only through integrations-github.public (security.md#module-boundaries).',
          },
          {
            group: [
              '**/auth/**',
              '!**/auth/account-handle.service*',
              '!**/auth/auth.module*',
              '!**/auth/events/',
              '**/auth/events/*',
              '!**/auth/events/user-deleted.event*',
            ],
            message: 'Repositories reaches Auth only through AccountHandleService and the user.deleted event (security.md#module-boundaries).',
          },
        ],
      }],
      'no-restricted-globals': ['error', {
        name: 'fetch',
        message: 'Repositories never calls GitHub directly; use IntegrationsGithubService.',
      }],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/*.db-spec.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      // Test doubles/fixtures legitimately grow past the source file limit.
      'max-lines': 'off',
    },
  },
];
