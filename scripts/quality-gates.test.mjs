import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ESLint } from 'eslint'
import { browserRuntime, launchBrowser } from './browser-runtime.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
test('lint covers all Vue components and browser runtimes and rejects actual defects', async () => {
  const eslint = new ESLint({ cwd: root })
  const components = (await readdir(path.join(root, 'docs/.vitepress/theme/components'))).filter(name => name.endsWith('.vue'))
  assert.ok(components.length >= 5)
  for (const component of components) {
    const config = await eslint.calculateConfigForFile(`docs/.vitepress/theme/components/${component}`)
    assert.equal(config.rules['vue/no-duplicate-attributes'][0], 2, component)
    assert.equal(config.rules['@typescript-eslint/no-unused-vars'][0], 2, component)
  }
  for (const file of ['standalone/main.ts', 'docs/.vitepress/theme/diagrams.ts', 'docs/.vitepress/theme/outline.ts']) {
    const config = await eslint.calculateConfigForFile(file)
    assert.equal(config.rules['no-unsafe-finally'][0], 2, file)
  }
  for (const [filePath, source, rule] of [
    ['docs/.vitepress/theme/components/LintProbe.vue', '<script setup lang="ts">const value = 1</script><template><div id="a" id="b">{{ value }}</div></template>', 'vue/no-duplicate-attributes'],
    ['standalone/probe.ts', 'const unused = 1', '@typescript-eslint/no-unused-vars'],
    ['docs/.vitepress/theme/probe.mjs', 'missingFunction()', 'no-undef'],
  ]) {
    const [result] = await eslint.lintText(source, { filePath })
    assert.ok(result.messages.some(message => message.ruleId === rule && message.severity === 2), `Lint did not detect ${rule} in ${filePath}`)
  }
})

test('browser gate fails on missing environment and cannot silently skip offline acceptance', async () => {
  assert.throws(() => browserRuntime(path.join(root, 'internal/no-such-playwright-directory')), /无法加载/)
  await assert.rejects(() => launchBrowser({ chromium: { launch: async () => { throw new Error('Missing browser binary') } }, launchOptions: {}, browserName: 'Test browser' }), /浏览器验收未通过/)
  assert.throws(() => execFileSync(process.execPath, ['scripts/verify-browser.mjs'], {
    cwd: root, stdio: 'pipe', env: { ...process.env, COURSE_PLAYWRIGHT_DIR: path.join(root, 'internal/no-such-playwright-directory') },
  }), error => error.status !== 0 && /无法加载/.test(String(error.stderr)) && !/回归通过/.test(String(error.stdout)))
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts.verify, 'node scripts/verify-local.mjs')
  assert.equal(pkg.scripts['verify:static'], 'node scripts/verify-local.mjs --static')
  assert.ok(pkg.devDependencies.playwright, 'Browser acceptance must have a declared dependency')
})
