import globals from 'globals'
export default [{ files: ['scripts/**/*.mjs'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node, ...globals.browser } }, rules: { 'no-undef': 'error', 'no-unreachable': 'error', 'no-dupe-keys': 'error', 'valid-typeof': 'error', 'no-unsafe-finally': 'error' } }]
