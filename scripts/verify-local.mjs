import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { assertDocumentationSync } from './documentation-sync.mjs'
const root = fileURLToPath(new URL('../', import.meta.url))
const staticOnly = process.argv.includes('--static')
if (process.argv.slice(2).some(arg => arg !== '--static')) throw new Error('用法：pnpm run verify 或 pnpm run verify:static')
await assertDocumentationSync(root)
console.log('文档同步检查通过（AGENTS 来自唯一规范源；SKILL 字节一致；中英文文档结构与命令一致）。')
for (const args of [
  ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit', '-p', 'tsconfig.json'],
  ['node_modules/eslint/bin/eslint.js', 'scripts', 'standalone', 'docs/.vitepress/theme', 'docs/.vitepress/config.mts', 'eslint.config.mjs', '--max-warnings=0'],
  ['scripts/verify-computer-models.mjs'],
  ['--test', 'scripts/standalone.test.mjs', 'scripts/build-contracts.test.mjs', 'scripts/outline-model.test.mjs', 'scripts/quality-gates.test.mjs', 'scripts/annotations.test.mjs'],
  ...(staticOnly ? [] : [['scripts/verify-browser.mjs']]),
]) {
  console.log('> node ' + args.join(' '))
  try { execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' }) }
  catch (error) { process.exit(error.status || 1) }
}
console.log(staticOnly
  ? '仅静态检查通过（含夹具构建）；尚未验证离线可用，不能作为完整验收或教材交付达标。'
  : '本地完整验收通过（含独立 HTML / 网站构建及离线浏览器夹具）；具体教材交付须另外运行 pnpm run verify:html。')
