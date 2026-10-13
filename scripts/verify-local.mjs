import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { assertDocumentationSync } from './documentation-sync.mjs'
const root = fileURLToPath(new URL('../', import.meta.url))
await assertDocumentationSync(root)
console.log('文档同步检查通过（SKILL 字节一致；README 章节与命令示例一致）。')
for (const args of [
  ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit', '-p', 'tsconfig.json'],
  ['node_modules/eslint/bin/eslint.js', 'scripts'],
  ['scripts/verify-computer-models.mjs'],
  ['--test', 'scripts/standalone.test.mjs', 'scripts/build-contracts.test.mjs', 'scripts/outline-model.test.mjs'],
]) {
  console.log('> node ' + args.join(' '))
  try { execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' }) }
  catch (error) { process.exit(error.status || 1) }
}
console.log('本地验收通过（含隔离夹具构建）；真实教材浏览器验收另行运行。')
