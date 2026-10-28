import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createFixture } from './test-fixture.mjs'
import { browserRuntime, launchBrowser } from './browser-runtime.mjs'
import { extractDiagramExample, stripDiagramAnimation } from './verification-inputs.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
test('native SVG diagrams work offline, without JS, with reduced motion, and across site routes', async t => {
  const runtime = browserRuntime()
  const { fixture, cleanup } = await createFixture()
  let browser, server
  t.after(async () => {
    server?.closeAllConnections()
    server?.close()
    await browser?.close()
    await cleanup()
  })
  const guide = await readFile(path.join(root, 'handbook/authoring.md'), 'utf8')
  const diagram = extractDiagramExample(guide)
  const staticDiagram = stripDiagramAnimation(diagram).replaceAll('signal-', 'static-')
  const secondDiagram = diagram.replaceAll('signal-', 'second-')
  const source = '# Native diagrams\n\n## Signal\n\nStatic explanation.\n\n' + diagram + '\n\n' + secondDiagram + '\n\n' + staticDiagram
  const content = path.join(fixture, 'content/diagrams')
  await mkdir(content, { recursive: true })
  await writeFile(path.join(content, 'manifest.json'), JSON.stringify({ topic: 'diagrams', title: 'Native diagrams', output: 'diagrams.html', chapters: ['one.md'] }))
  await writeFile(path.join(content, 'one.md'), source)
  execFileSync(process.execPath, ['scripts/build-standalone.mjs', 'diagrams'], { cwd: fixture, stdio: 'pipe' })
  const file = path.join(fixture, 'dist/diagrams.html')
  // Delivery checks must accept progressively enhanced animation controls,
  // but still reject actual paragraph loss when JavaScript runs.
  execFileSync(process.execPath, ['scripts/verify-native-html.mjs'], { cwd: fixture, stdio: 'pipe' })
  const original = await readFile(file, 'utf8')
  try {
    await writeFile(file, original.replace('</body>', '<script>document.querySelector("article > p").remove()</script></body>'))
    assert.throws(() => execFileSync(process.execPath, ['scripts/verify-native-html.mjs'], { cwd: fixture, stdio: 'pipe' }), error => /关闭 JavaScript 后可读正文发生变化/.test(String(error.stderr)))
  } finally { await writeFile(file, original) }
  browser = await launchBrowser(runtime)
  const reportDir = path.join(root, 'internal/native-diagram-test')
  await mkdir(reportDir, { recursive: true })
  await copyFile(file, path.join(reportDir, 'demo.html'))

  const noJs = await browser.newContext({ offline: true, javaScriptEnabled: false })
  const staticPage = await noJs.newPage()
  await staticPage.goto(pathToFileURL(file).href)
  assert.equal(await staticPage.locator('[data-course-animation-controls]:visible').count(), 0)
  assert.equal(await staticPage.locator('#signal-diagram circle').evaluate(circle => circle.cx.animVal.value), 40)
  assert.equal(await staticPage.locator('#static-diagram').isVisible(), true)
  assert.equal(await staticPage.locator('figcaption').count(), 3)
  await staticPage.screenshot({ path: path.join(reportDir, 'no-js.png'), fullPage: true })
  await noJs.close()

  const context = await browser.newContext({ offline: true, viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const errors = [], requests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('request', request => requests.push(request.url()))
  await page.goto(pathToFileURL(file).href)
  const first = page.locator('[data-course-animation]').first()
  const svg = page.locator('#signal-diagram')
  const play = first.locator('[data-course-animation-play]')
  const pause = first.locator('[data-course-animation-pause]')
  const reset = first.locator('[data-course-animation-reset]')
  assert.equal(await play.isVisible(), true)
  assert.equal(await svg.evaluate(svg => svg.animationsPaused()), true)
  assert.equal(await page.locator('#signal-diagram circle').evaluate(circle => circle.cx.animVal.value), 40)
  await play.focus()
  await play.press('Enter')
  await page.waitForFunction(() => document.querySelector('#signal-diagram circle').cx.animVal.value > 45)
  assert.equal(await play.isDisabled(), true)
  assert.equal(await page.locator('#second-diagram circle').evaluate(circle => circle.cx.animVal.value), 40, 'Animation controls must be isolated per figure')
  await pause.click()
  const pausedTime = await svg.evaluate(svg => svg.getCurrentTime())
  await page.waitForTimeout(150)
  assert.equal(await svg.evaluate(svg => svg.getCurrentTime()), pausedTime)
  await play.click()
  await page.waitForFunction(time => document.querySelector('#signal-diagram').getCurrentTime() > time + 0.1, pausedTime)
  await reset.click()
  assert.equal(await svg.evaluate(svg => svg.animationsPaused()), true)
  assert.equal(await page.locator('#signal-diagram circle').evaluate(circle => circle.cx.animVal.value), 40)
  await play.click()
  await page.waitForFunction(() => document.querySelector('#signal-diagram circle').cx.animVal.value > 45)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await first.locator('[data-course-animation-controls]').waitFor({ state: 'hidden' })
  assert.equal(await svg.evaluate(svg => svg.animationsPaused()), true)
  assert.equal(await page.locator('#signal-diagram circle').evaluate(circle => circle.cx.animVal.value), 40)
  await page.reload()
  assert.equal(await first.locator('[data-course-animation-controls]').isVisible(), false)
  assert.equal(await page.locator('#signal-diagram circle').evaluate(circle => circle.cx.animVal.value), 40)
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
  await play.waitFor({ state: 'visible' })
  const color = await page.locator('#signal-diagram circle').evaluate(circle => getComputedStyle(circle).fill)
  assert.equal(color, 'rgb(77, 188, 174)')
  await page.screenshot({ path: path.join(reportDir, 'dark.png'), fullPage: true })
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.ok(await svg.evaluate(svg => svg.getBoundingClientRect().width <= innerWidth))
  }
  await page.screenshot({ path: path.join(reportDir, 'mobile.png'), fullPage: true })
  assert.deepEqual(errors, [])
  assert.deepEqual(requests.filter(url => /^https?:/.test(url)), [])
  await context.close()

  // Site navigation must mount controls on the new page and clean up the old one.
  await writeFile(path.join(fixture, 'docs/index.md'), source + '\n\n[Next page](/next)\n')
  await writeFile(path.join(fixture, 'docs/next.md'), '# Next diagram\n\n' + diagram + '\n\n[First page](/)\n')
  execFileSync(process.execPath, ['scripts/build-site.mjs'], { cwd: fixture, stdio: 'pipe' })
  const siteRoot = path.join(fixture, 'docs/.vitepress/dist')
  server = createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      if (pathname.endsWith('/')) pathname += 'index.html'
      if (!path.extname(pathname)) pathname += '.html'
      const target = path.resolve(siteRoot, '.' + pathname)
      if (!target.startsWith(siteRoot + path.sep)) throw new Error('Invalid site path')
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }
      response.setHeader('Content-Type', mime[path.extname(target)] ?? 'application/octet-stream')
      response.end(await readFile(target))
    } catch { response.statusCode = 404; response.end() }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = `http://127.0.0.1:${server.address().port}/`
  const sitePage = await browser.newPage()
  sitePage.on('pageerror', error => errors.push(error.message))
  await sitePage.goto(address)
  await sitePage.locator('[data-course-animation-play]').first().waitFor({ state: 'visible' })
  await sitePage.getByRole('link', { name: 'Next page', exact: true }).click()
  await sitePage.locator('[data-course-animation-play]').waitFor({ state: 'visible' })
  await sitePage.locator('[data-course-animation-play]').click()
  await sitePage.waitForFunction(() => document.querySelector('#signal-diagram circle').cx.animVal.value > 45)
  await sitePage.getByRole('link', { name: 'First page', exact: true }).click()
  await sitePage.locator('[data-course-animation-play]').first().waitFor({ state: 'visible' })
  assert.equal(await sitePage.locator('#signal-diagram circle').evaluate(circle => circle.cx.animVal.value), 40)
  assert.deepEqual(errors, [])
  await writeFile(path.join(reportDir, 'checks.json'), JSON.stringify({ browser: `${runtime.browserName} ${browser.version()}`, offline: true, noJavaScript: true, staticDiagram: true, playPauseResumeReset: true, keyboard: true, isolatedFigures: true, reducedMotion: true, darkMode: true, widths: [390, 320], noExternalRequests: true, siteNavigation: true }, null, 2))
})
