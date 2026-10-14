import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

const correctness = {
  'no-undef': 'error', 'no-unreachable': 'error', 'no-dupe-keys': 'error',
  'valid-typeof': 'error', 'no-unsafe-finally': 'error',
}

export default defineConfig([
  { ignores: ['internal/**', 'dist/**', '.standalone/**', 'docs/.vitepress/dist/**', 'docs/.vitepress/cache/**'] },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: correctness,
  },
  {
    files: ['docs/.vitepress/theme/**/*.mjs'],
    languageOptions: { globals: globals.browser },
    rules: correctness,
  },
  {
    files: ['docs/.vitepress/**/*.{ts,mts}', 'standalone/**/*.ts'],
    extends: [tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    rules: { ...correctness, 'no-undef': 'off' }, // TypeScript checks identifiers, including type names.
  },
  { files: ['docs/.vitepress/config.mts'], languageOptions: { globals: globals.node } },
  {
    files: ['docs/.vitepress/theme/**/*.vue'],
    extends: [tseslint.configs.recommended, vue.configs['flat/essential']],
    languageOptions: { globals: globals.browser, parserOptions: { parser: tseslint.parser } },
    rules: { ...correctness, 'no-undef': 'off', 'vue/no-unused-vars': 'error' },
  },
])
