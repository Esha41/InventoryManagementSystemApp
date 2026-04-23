// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

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

      // ─── ARCHITECTURE BOUNDARY ENFORCEMENT ───────────────────────────────
      // shared/ must never import from features/ — it would create
      // circular dependencies and destroy feature isolation.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/**'],
              message:
                'shared/ must not import from features/. Move domain logic into the feature, or extract a truly generic primitive into shared/ui/.',
            },
          ],
        },
      ],
    },
  },
  {
    // Relax the boundary rule for files INSIDE features/ — they may import
    // from core/ and shared/ freely, but NOT from other sibling features/.
    files: ['src/app/features/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Cross-feature imports: features/X importing from features/Y
              // This pattern intentionally allows @core/* and @shared/* via alias.
              // Adjust the group regex to match your actual feature directory names.
              group: [
                '../../../admin/**',
                '../../../auth/**',
                '../../../assets/**',
                '../../../warehouse/**',
                '../../../requests/**',
                '../../../inventory/**',
                '../../../dashboard/**',
                '../../../notifications/**',
                '../../../reports/**',
                '../../../workflow/**',
                '../../../forecast/**',
                '../../../profile/**',
                '../../../settings/**',
                '../../../department/**',
                '../../../help/**',
                '../../../onboarding/**',
              ],
              message:
                'Cross-feature imports are forbidden. Expose shared contracts via core/ services, facades, or shared/ primitives instead.',
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
);
