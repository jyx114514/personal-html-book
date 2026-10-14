import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { createFixture } from './test-fixture.mjs'
import { browserRuntime, launchBrowser } from './browser-runtime.mjs'
import { extractInteractionScript, parsePrivateTerms } from './verification-inputs.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function fail(message) { console.error('浏览器验收失败：' + message); process.exit(1) }
let forbidden
try { forbidden = parsePrivateTerms(process.env.COURSE_PRIVATE_TERMS) } catch (error) { fail(error.message) }
let names
try { names = (await readdir(path.join(root, 'dist'))).filter(name => name.endsWith('.html')) }
catch (error) { if (error.code === 'ENOENT') fail('未找到 dist/；请先构建至少一个独立 HTML。'); throw error }
if (!names.length) fail('dist/ 中没有 HTML；请先构建教材。')
let runtime
try { runtime = browserRuntime(process.argv[2]) } catch (error) { fail(error.message) }
const directory = path.join(root, 'internal/native-html-test')
await mkdir(directory, { recursive: true })
let browser
try { browser = await launchBrowser(runtime) } catch (error) { fail(error.message) }
let fixture, cleanup
try { ({ fixture, cleanup } = await createFixture()) } catch (error) { await browser.close(); throw error }
const report = { browser: `${runtime.browserName} ${browser.version()}`, offline: true, topics: [] }
const extractBody = html => {
  const match = html.match(/<!-- course:body:start -->(?:\r?\n)?([\s\S]*?)(?:\r?\n)?<!-- course:body:end -->/)
  assert.ok(match, 'Missing editable body markers')
  return match[1]
}
const normalize = text => text.replace(/\s|\u200b/g, '')
try {
  for (const name of names) {
    const topic = name.slice(0, -5)
    const originalPath = path.join(root, 'dist', name)
    const original = await readFile(originalPath, 'utf8')
    const js = extractInteractionScript(original, name)
    assert.ok(extractBody(original) !== undefined, 'Missing editable body markers')
    const manifest = JSON.parse(await readFile(path.join(root, 'content', topic, 'manifest.json'), 'utf8'))
    const validation = { minBodyLength: 1, minFormulas: 0, ...(manifest.validation ?? {}) }
    for (const key of ['minBodyLength', 'minFormulas']) assert.ok(Number.isInteger(validation[key]) && validation[key] >= 0, 'Invalid validation threshold: ' + key)
    await mkdir(path.join(fixture, 'content', topic), { recursive: true })
    await mkdir(path.join(fixture, 'dist'), { recursive: true })
    await writeFile(path.join(fixture, 'content', topic, 'manifest.json'), JSON.stringify(manifest))
    const fixturePath = path.join(fixture, 'dist', name)
    const folder = path.join(directory, topic)
    await mkdir(folder, { recursive: true })
    const standalonePath = path.join(folder, 'book.html')
    await copyFile(originalPath, standalonePath)
    const context = await browser.newContext({ offline: true, viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    const errors = [], requests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('request', request => requests.push(request.url()))
    await page.goto(pathToFileURL(standalonePath).href)
    const bodyText = await page.locator('article').innerText()
    const counts = {
      headings: await page.locator('article h2').count(),
      formulas: await page.locator('mjx-container svg').count(),
      codeBlocks: await page.locator('pre code').count(),
      labs: await page.locator('[data-course-component]').count(),
      navigation: await page.locator('aside nav a').count()
    }
    assert.ok(bodyText.length >= validation.minBodyLength)
    assert.ok(counts.formulas >= validation.minFormulas)
    // Accept both current container attributes and historical v5 source wrappers.
    assert.equal(await page.locator('mjx-container[data-tex], [id^="mjx-"][data-tex]').count(), counts.formulas)
    assert.equal(await page.locator('.course-table-scroll .course-table-scroll').count(), 0)
    const staticBody = extractBody(original)
    assert.match(staticBody, /<article class="vp-doc">/)
    assert.match(staticBody, /<p>/)
    const prose = await page.locator('article > p, article > section > p').allTextContents()
    for (const text of prose.filter(text => text.trim().length >= 80)) assert.ok(!js.includes(text.trim()), 'Article prose embedded in runtime')
    assert.doesNotMatch(original, /chatgpt\.com\/share|sources[\/\\]|internal[\/\\]|\b[a-z]:[\/\\]|turn\d+(search|view)/i)

    assert.doesNotMatch(original, /(?:\/home\/|\/Users\/)[^\s<>/]+\//)
    for (const term of forbidden) assert.ok(!original.includes(term), 'Private term found in HTML')

    // The current HTML includes human revisions. Historical backups are provenance only.
    await page.screenshot({ path: path.join(folder, 'desktop.png') })
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
    await page.screenshot({ path: path.join(folder, 'mobile.png') })

    const noJsContext = await browser.newContext({ offline: true, javaScriptEnabled: false })
    const noJs = await noJsContext.newPage()
    noJs.on('request', request => requests.push(request.url()))
    noJs.on('pageerror', error => errors.push(error.message))
    await noJs.goto(pathToFileURL(standalonePath).href)
    assert.equal(normalize(await noJs.locator('article').innerText()), normalize(bodyText))
    assert.equal(await noJs.locator('mjx-container svg').count(), counts.formulas)
    assert.equal(await noJs.locator('pre code').count(), counts.codeBlocks)
    assert.equal(await noJs.locator('aside nav a').count(), counts.navigation)
    for (const lab of await noJs.locator('[data-course-component]').all()) assert.ok(await lab.isVisible())
    await noJsContext.close()

    // Exercise only an isolated copy. A killed process cannot modify the authoritative HTML.
    const articleEnd = original.lastIndexOf('</article>')
    assert.ok(articleEnd >= 0, 'Missing article end')
    const appended = original.slice(0, articleEnd) + '<p id="native-edit-check">正文编辑验收：保存 HTML 后直接刷新。</p>\n' + original.slice(articleEnd)
    assert.equal(appended.slice(0, articleEnd), original.slice(0, articleEnd), 'Append changed existing content')
    const edited = appended
      .replace('</title>', ' · 编辑验收</title>')
      .replace(/\r?\n/g, '\r\n') // Typical Windows editor save must also preserve edits.
    try {
      await writeFile(fixturePath, edited)
      await copyFile(fixturePath, standalonePath)
      await page.goto(pathToFileURL(standalonePath).href)
      assert.equal(await page.locator('#native-edit-check').innerText(), '正文编辑验收：保存 HTML 后直接刷新。')
      // Events and experiment updates must never replace the edited article.
      for (const lab of await page.locator('[data-course-component]').all()) {
        for (const slider of await lab.locator('input[type="range"]').all()) {
          const before = await slider.inputValue()
          await slider.focus(); await slider.press('ArrowRight')
          if (await slider.inputValue() === before) await slider.press('ArrowLeft')
          assert.notEqual(await slider.inputValue(), before, 'Slider did not respond')
        }
        for (const select of await lab.locator('select').all()) {
          const options = await select.locator('option').evaluateAll(options => options.map(option => option.value))
          for (const value of options) await select.selectOption(value)
        }
        for (const input of await lab.locator('input[type="number"], input[type="text"], input:not([type])').all()) { await input.fill('1'); await input.press('Tab') }
        for (const button of await lab.locator('button').all()) if (await button.isEnabled()) await button.click()
      }
      assert.equal(await page.locator('#native-edit-check').count(), 1)
      execFileSync(process.execPath, [path.join(fixture, 'scripts/build-standalone.mjs'), topic], { cwd: fixture, stdio: 'pipe' })
      const repacked = await readFile(fixturePath, 'utf8')
      assert.equal(extractBody(repacked), extractBody(edited), 'Re-export overwrote edited body')
      assert.match(repacked, / · 编辑验收<\/title>/)
      await copyFile(fixturePath, standalonePath)
      await page.goto(pathToFileURL(standalonePath).href)
      assert.equal(await page.locator('#native-edit-check').innerText(), '正文编辑验收：保存 HTML 后直接刷新。')
    } finally {
      await writeFile(fixturePath, original)
      await copyFile(fixturePath, standalonePath)
    }
    assert.deepEqual(errors, [])
    assert.deepEqual(requests.filter(url => /^https?:/.test(url)), [])
    assert.ok(requests.filter(url => url.startsWith('file:')).every(url => url.endsWith('.html')), 'Companion file requested')
    assert.equal(await readFile(originalPath, 'utf8'), original, 'Authoritative HTML changed during validation')
    report.topics.push({ topic, counts, thresholds: validation, allLabControlsExercised: true, baseline: 'current HTML', noJavaScriptReadable: true, appendAndReexportPreservesBody: true, directEditAndReexport: true, narrowWidths: [390, 320], errors, externalRequests: [] })
    await context.close()
  }
  await writeFile(path.join(directory, 'results.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close(); await cleanup() }
