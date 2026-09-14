import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      'core-harness/**',
      'packages/db/migrations/**',
      'apps/web/test-results/**',
      'apps/web/playwright-report/**',
      'scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextVitals.map((c) => ({ ...c, files: ['apps/web/**/*.{ts,tsx}'] })),
  {
    rules: {
      // El prompt maestro §80: sin `any` salvo justificación escrita al lado.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    settings: { next: { rootDir: 'apps/web' } },
  },
)
