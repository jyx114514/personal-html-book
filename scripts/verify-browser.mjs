import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { browserRuntime, launchBrowser } from './browser-runtime.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
try {
  const runtime = browserRuntime()
  const browser = await launchBrowser(runtime)
  console.log(`浏览器环境检查通过：${runtime.browserName} ${browser.version()}`)
  await browser.close()
  execFileSync(process.execPath, ['--test', '--test-concurrency=1', 'scripts/browser-shell.test.mjs', 'scripts/browser-diagrams.test.mjs'], { cwd: root, stdio: 'inherit' })
  console.log('浏览器夹具回归通过（断网 file://、无外部请求、禁用 JavaScript 阅读及交互）；具体教材交付仍须运行 pnpm run verify:html。')
} catch (error) {
  console.error(error.message)
  process.exit(error.status || 1)
}
