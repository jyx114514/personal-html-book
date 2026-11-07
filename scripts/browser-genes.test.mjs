import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createFixture } from './test-fixture.mjs'
import { launchBrowser } from './browser-runtime.mjs'
import { reverseComplement } from '../docs/.vitepress/theme/gene-model.mjs'
import { createServer } from 'node:http'

const root = fileURLToPath(new URL('../', import.meta.url))
export const demoGene = {
  name: '教学质粒 · 合成示意', sequence: 'ATGCGT'.repeat(200), topology: 'circular',
  features: [
    { name: '启动子示意', start: 40, end: 180, strand: 1, description: '教学注释，不代表此序列具有真实启动子功能。' },
    { name: 'CDS 示意', start: 240, end: 780, strand: 1, description: '用注释区间说明方向和坐标，未作功能预测。' },
    { name: '反向特征', start: 840, end: 1080, strand: -1 },
    { name: '跨起点特征', start: 1150, end: 30, strand: -1 },
    { name: '无方向基序', start: 500, end: 505, strand: 0 },
  ],
}

test('gene viewer works offline with static fallback, selection, search, clipboard, themes and multiple instances', async t => {
  const { fixture, cleanup } = await createFixture()
  let browser, server
  t.after(async () => { server?.closeAllConnections(); server?.close(); await browser?.close(); await cleanup() })
  const content = path.join(fixture, 'content/genes')
  await mkdir(content, { recursive: true })
  await writeFile(path.join(content, 'manifest.json'), JSON.stringify({ topic: 'genes', title: 'Gene viewer', output: 'genes.html', chapters: ['one.md'] }))
  const fence = gene => '```gene-viewer\n' + JSON.stringify(gene) + '\n```'
  await writeFile(path.join(content, 'one.md'), '# Sequence explorer\n\n## Gene\n\n这是**关键结论。**后文\n\n' + fence(demoGene) + '\n\n' + fence({ name: 'Linear', sequence: 'ACGTNRY', topology: 'linear' }))
  execFileSync(process.execPath, ['scripts/build-standalone.mjs', 'genes'], { cwd: fixture, stdio: 'pipe' })
  const file = path.join(fixture, 'dist/genes.html')
  execFileSync(process.execPath, ['scripts/verify-native-html.mjs'], { cwd: fixture, stdio: 'pipe' })
  const original = await readFile(file, 'utf8')
  const body = html => html.match(/<!-- course:body:start -->\n([\s\S]*?)\n<!-- course:body:end -->/)[1]
  execFileSync(process.execPath, ['scripts/build-standalone.mjs', 'genes'], { cwd: fixture, stdio: 'pipe' })
  assert.equal(body(await readFile(file, 'utf8')), body(original), 'Repacking must preserve all body markup')
  browser = await launchBrowser()
  const directory = path.join(root, 'internal/gene-viewer-test')
  await mkdir(directory, { recursive: true })
  await copyFile(file, path.join(directory, 'demo.html'))
  const noJs = await browser.newContext({ offline: true, javaScriptEnabled: false })
  const staticPage = await noJs.newPage()
  const staticRequests = []
  staticPage.on('request', request => staticRequests.push(request.url()))
  await staticPage.goto(pathToFileURL(file).href)
  assert.equal(await staticPage.locator('[data-gene-controls]:visible').count(), 0)
  assert.equal(await staticPage.locator('[data-gene-map] svg').count(), 2)
  assert.equal(await staticPage.locator('[data-gene-position]').count(), 607)
  await staticPage.locator('.gene-source summary').first().click()
  assert.equal(await staticPage.locator('[data-gene-raw]').first().innerText(), demoGene.sequence)
  assert.equal(staticRequests.filter(url => !url.startsWith('file:')).length, 0)
  await noJs.close()
  const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1050 } })
  const page = await context.newPage()
  const errors = [], requests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => requests.push(request.url()))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.geneCopied = text } } })
  })
  await page.goto(pathToFileURL(file).href)
  const viewer = page.locator('[data-gene-viewer]').first(), second = page.locator('[data-gene-viewer]').nth(1)
  assert.equal(await viewer.locator('[data-gene-feature="4"] .gene-arrow').count(), 0)
  await viewer.locator('[data-gene-annotation="4"]').click()
  assert.match(await viewer.locator('[data-gene-status]').innerText(), /无方向/)
  await viewer.locator('[data-gene-annotation="1"]').focus()
  await page.keyboard.press('Enter')
  assert.equal(await viewer.locator('.gene-selected').count(), 361)
  assert.match(await viewer.locator('[data-gene-status]').innerText(), /240–780 · 541 bp/)
  assert.equal(await second.locator('[data-gene-copy]').isDisabled(), true)
  await viewer.locator('[data-gene-copy]').click()
  assert.equal(await page.evaluate(() => window.geneCopied), demoGene.sequence.slice(239, 780))
  await viewer.locator('[data-gene-reverse]').click()
  assert.equal(await page.evaluate(() => window.geneCopied), reverseComplement(demoGene.sequence.slice(239, 780)))
  await viewer.locator('[data-gene-annotation="3"]').click()
  await viewer.locator('[data-gene-copy]').click()
  assert.equal(await page.evaluate(() => window.geneCopied), demoGene.sequence.slice(1149) + demoGene.sequence.slice(0, 30))
  await viewer.locator('[data-gene-view="linear"]').click()
  assert.equal(await viewer.locator('[data-gene-view="linear"]').getAttribute('aria-pressed'), 'true')
  await viewer.locator('[data-gene-search]').fill('ATGCGT')
  assert.match(await viewer.locator('[data-gene-status]').innerText(), /匹配 1\/200/)
  await viewer.locator('[data-gene-next]').click()
  assert.equal(await viewer.locator('[data-gene-start]').inputValue(), '7')
  await viewer.locator('[data-gene-search]').fill('TTTT')
  assert.match(await viewer.locator('[data-gene-status]').innerText(), /无匹配/)
  await viewer.locator('[data-gene-start]').fill('0')
  await viewer.locator('[data-gene-select]').click()
  assert.match(await viewer.locator('[data-gene-status]').innerText(), /整数坐标/)
  await viewer.locator('[data-gene-reset]').click()
  await viewer.locator('[data-gene-position="3"]').click()
  await viewer.locator('[data-gene-position="8"]').click()
  assert.equal(await viewer.locator('.gene-selected').count(), 6)
  await viewer.locator('[data-gene-next-page]').click()
  assert.equal(await viewer.locator('[data-gene-page]').innerText(), '601–1200')
  await second.locator('[data-gene-start]').fill('7')
  await second.locator('[data-gene-end]').fill('1')
  await second.locator('[data-gene-select]').click()
  assert.match(await second.locator('[data-gene-status]').innerText(), /线性序列/)
  // Clipboard failure must expose a selected, manually copyable sequence.
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Denied') } })
  await viewer.locator('[data-gene-copy]').click()
  assert.equal(await viewer.locator('[data-gene-copy-fallback]').inputValue(), demoGene.sequence.slice(2, 8))
  await viewer.locator('[data-gene-reset]').click()
  await viewer.locator('[data-gene-view="circular"]').click()
  for (const width of [2560, 1920, 1440, 800, 390, 320]) {
    await page.setViewportSize({ width, height: 1050 })
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `${width} ${colorScheme} overflow`)
      if (width >= 1440) assert.ok((await viewer.locator('[data-gene-map]').boundingBox()).width <= 480, 'Wide screens must not enlarge the plasmid map without a limit')
      await viewer.screenshot({ path: path.join(directory, `${width}-${colorScheme}.png`) })
    }
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(requests.filter(url => !url.startsWith('file:')), [])
  assert.equal(requests.filter(url => url.startsWith('file:') && !url.endsWith('.html')).length, 0)
  await context.close()

  // Use the real site renderer and navigate away/back to detect duplicate mounts.
  await writeFile(path.join(fixture, 'docs/index.md'), '# Gene site\n\n这是**关键结论。**后文\n\n' + fence(demoGene) + '\n\n[Next page](/next)\n')
  await writeFile(path.join(fixture, 'docs/next.md'), '# Next viewer\n\n' + fence(demoGene) + '\n\n[First page](/)\n')
  execFileSync(process.execPath, ['scripts/build-site.mjs'], { cwd: fixture, stdio: 'pipe' })
  const siteRoot = path.join(fixture, 'docs/.vitepress/dist')
  server = createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      if (pathname.endsWith('/')) pathname += 'index.html'
      if (!path.extname(pathname)) pathname += '.html'
      const target = path.resolve(siteRoot, '.' + pathname)
      if (!target.startsWith(siteRoot + path.sep)) throw new Error('Invalid site path')
      response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(target)] ?? 'application/octet-stream')
      response.end(await readFile(target))
    } catch { response.statusCode = 404; response.end() }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const site = await browser.newPage()
  site.on('pageerror', error => errors.push(error.message))
  await site.goto(`http://127.0.0.1:${server.address().port}/`)
  await site.locator('[data-gene-controls]').first().waitFor({ state: 'visible' })
  assert.equal(await site.locator('.vp-doc strong').first().innerText(), '关键结论。')
  for (const link of ['Next page', 'First page']) {
    await site.getByRole('link', { name: link, exact: true }).click()
    await site.locator('[data-gene-controls]').first().waitFor({ state: 'visible' })
    await site.locator('[data-gene-search]').fill('ATGCGT')
    await site.locator('[data-gene-next]').click()
    assert.equal(await site.locator('[data-gene-start]').inputValue(), '7', 'One click must advance exactly once after navigation')
  }
  assert.deepEqual(errors, [])
  await writeFile(path.join(directory, 'results.json'), JSON.stringify({ browser: browser.version(), offline: true, noJs: true, widths: [2560, 1920, 1440, 800, 390, 320], selection: true, circularOrigin: true, clipboardAndFallback: true, bodyPreserved: true, siteNavigation: true, errors }, null, 2))
})
