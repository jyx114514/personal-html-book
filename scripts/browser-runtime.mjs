import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
export function browserRuntime(moduleDirectory = process.env.COURSE_PLAYWRIGHT_DIR || path.join(root, 'node_modules')) {
  const require = createRequire(path.join(root, 'package.json'))
  const playwrightPath = path.resolve(moduleDirectory, 'playwright')
  let chromium
  try { ({ chromium } = require(playwrightPath)) }
  catch (error) { throw new Error(`无法加载 ${playwrightPath}；运行 pnpm install --frozen-lockfile，或将 COURSE_PLAYWRIGHT_DIR 指向直接包含 playwright/ 的 node_modules 目录。${error.message}`) }
  const channel = process.env.COURSE_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium')
  if (!['msedge', 'chrome', 'chromium'].includes(channel)) throw new Error(`Invalid COURSE_BROWSER_CHANNEL: ${channel}`)
  return { chromium, launchOptions: { channel, headless: true }, browserName: { msedge: 'Microsoft Edge', chrome: 'Google Chrome', chromium: 'Chromium' }[channel] }
}

export async function launchBrowser(runtime = browserRuntime()) {
  try { return await runtime.chromium.launch(runtime.launchOptions) }
  catch (error) { throw new Error(`无法启动 ${runtime.browserName}；浏览器验收未通过，不得报告完整验收成功。可使用已有 Edge，或运行 pnpm exec playwright install chromium 并设置 COURSE_BROWSER_CHANNEL=chromium。${error.message}`) }
}
