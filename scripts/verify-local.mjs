import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
for (const args of [
  ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit', '-p', 'tsconfig.json'],
  ['node_modules/eslint/bin/eslint.js', 'scripts'],
  ['scripts/verify-computer-models.mjs'],
  ['--test', 'scripts/standalone.test.mjs'],
]) {
  console.log('> node ' + args.join(' '))
  try { execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' }) }
  catch (error) { process.exit(error.status || 1) }
}
console.log('本地验收通过（含隔离夹具构建）；真实教材浏览器验收另行运行。')
