import js from '@eslint/js'
import globals from 'globals'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    ignores: ['dist/**', 'android/**', 'node_modules/**', '.git/**', 'public/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['server/**/*.js', 'server/**/*.cjs', 'daemon/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
])
