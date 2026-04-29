// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

/** Import paths that belong to lazy-loaded feature areas (path aliases). */
const FEATURE_ALIAS_PATTERNS = [
  '@app/features/**',
  '@features/**',
  '@auth/**',
  '@dashboard/**',
  '@warehouse/**',
  '@requests/**',
  '@inventory/**',
  '@assets/**',
  '@workflow/**',
  '@department/**',
  '@forecast/**',
  '@admin/**',
  '@settings/**',
  '@notifications/**',
  '@profile/**',
  '@reports/**',
  '@supply/**',
  '@help-center/**',
];

export default tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      /** Bump to `'error'` once remaining explicit `any` usages are cleared (strict TS hygiene). */
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_'
        }
      ],
    },
  },
  {
    files: ['src/app/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',

        {
          patterns: [
            {
              group: FEATURE_ALIAS_PATTERNS,
              message:
                'shared/ must not import feature modules. Move UI into the owning feature under src/app/features/, or keep only generic primitives in shared/.',
            },
            {
              group: ['**/features/**'],
              message: 'shared/ must not use relative imports into features/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: FEATURE_ALIAS_PATTERNS,
              message:
                'core/ must not import feature modules. Put transport-only code in core/ and call feature services from features/.',
            },
            {
              group: ['**/features/**'],
              message: 'core/ must not use relative imports into features/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/app/core/**', 'src/app/shared/**'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: '@services/backend-user.service',
              message:
                'Deprecated BackendUserService — import UsersApiService, UserRolesApiService, RolesApiService, RoleMembersApiService, PermissionsApiService, or ApplicationEntitiesApiService from @services/user-management (or @services). Scheduled removal Q2 2026. See backend-user.service.ts (BACKEND_USER_SERVICE_MIGRATION).',
            },
          ],
        },
      ],
    },
  },
);
