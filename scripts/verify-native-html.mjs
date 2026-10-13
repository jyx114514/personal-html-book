import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Supply an existing browser runtime; this check never installs dependencies.
const require = createRequire(path.resolve(process.argv[2], '../package.json'))
const { chromium } = require(path.resolve(process.argv[2], 'playwright'))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, 'internal/native-html-test')
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const report = { browser: `Microsoft Edge ${browser.version()}`, offline: true, topics: [] }
const extractBody = html => html.match(/<!-- course:body:start -->\r?\n([\s\S]*?)\r?\n<!-- course:body:end -->/)[1]
const normalize = text => text.replace(/\s|\u200b/g, '')
try {
  for (const name of (await readdir(path.join(root, 'dist'))).filter(name => name.endsWith('.html'))) {
    const topic = name.slice(0, -5)
    const originalPath = path.join(root, 'dist', name)
    const original = await readFile(originalPath, 'utf8')
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
    assert.ok(bodyText.length > 5000)
    assert.ok(counts.formulas > 5)
    assert.equal(await page.locator('[id^="mjx-"][data-tex]').count(), counts.formulas)
    assert.equal(await page.locator('.course-table-scroll .course-table-scroll').count(), 0)
    const staticBody = extractBody(original)
    assert.match(staticBody, /<article class="vp-doc">/)
    assert.match(staticBody, /<p>/)
    const js = original.match(/<script id="course-interactions">([\s\S]*?)<\/script>/)[1]
    assert.ok(!js.includes(topic === 'omics' ? '读多组学论文时' : '学习 HTML、Python、图形界面或机器学习时'))
    assert.doesNotMatch(original, /chatgpt\.com\/share|sources[\/\\]|internal[\/\\]|\b[a-zA-Z]:[\/\\]|turn\d+(search|view)/)

    // The current HTML includes human revisions. Historical backups are provenance only.
    await page.screenshot({ path: path.join(folder, 'desktop.png') })
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
    await page.screenshot({ path: path.join(folder, 'mobile.png') })

    const noJsContext = await browser.newContext({ offline: true, javaScriptEnabled: false })
    const noJs = await noJsContext.newPage()
    await noJs.goto(pathToFileURL(standalonePath).href)
    assert.equal(normalize(await noJs.locator('article').innerText()), normalize(bodyText))
    assert.equal(await noJs.locator('mjx-container svg').count(), counts.formulas)
    assert.equal(await noJs.locator('pre code').count(), counts.codeBlocks)
    assert.equal(await noJs.locator('aside nav a').count(), counts.navigation)
    assert.ok(await noJs.locator('[data-course-component]').first().isVisible())
    await noJsContext.close()

    // Exercise the actual exporter, then restore the delivered file even on failure.
    const articleEnd = original.lastIndexOf('</article>')
    assert.ok(articleEnd >= 0, 'Missing article end')
    const appended = original.slice(0, articleEnd) + '<p id="native-edit-check">正文编辑验收：保存 HTML 后直接刷新。</p>\n' + original.slice(articleEnd)
    assert.equal(appended.slice(0, articleEnd), original.slice(0, articleEnd), 'Append changed existing content')
    const edited = appended
      .replace('</title>', ' · 编辑验收</title>')
      .replace(/\r?\n/g, '\r\n') // Typical Windows editor save must also preserve edits.
    try {
      await writeFile(originalPath, edited)
      await copyFile(originalPath, standalonePath)
      await page.goto(pathToFileURL(standalonePath).href)
      assert.equal(await page.locator('#native-edit-check').innerText(), '正文编辑验收：保存 HTML 后直接刷新。')
      // Events and experiment updates must never replace the edited article.
      const lab = page.locator('[data-course-component]').first()
      const slider = lab.locator('input[type="range"]').first()
      if (await slider.count()) { await slider.focus(); await slider.press('ArrowRight') }
      assert.equal(await page.locator('#native-edit-check').count(), 1)
      execFileSync(process.execPath, [path.join(root, 'scripts/build-standalone.mjs'), topic], { cwd: root, stdio: 'pipe' })
      const repacked = await readFile(originalPath, 'utf8')
      assert.equal(extractBody(repacked), extractBody(edited), 'Re-export overwrote edited body')
      assert.match(repacked, / · 编辑验收<\/title>/)
      await copyFile(originalPath, standalonePath)
      await page.goto(pathToFileURL(standalonePath).href)
      assert.equal(await page.locator('#native-edit-check').innerText(), '正文编辑验收：保存 HTML 后直接刷新。')
    } finally {
      await writeFile(originalPath, original)
      await copyFile(originalPath, standalonePath)
    }
    assert.deepEqual(errors, [])
    assert.deepEqual(requests.filter(url => /^https?:/.test(url)), [])
    assert.ok(requests.filter(url => url.startsWith('file:')).every(url => url.endsWith('.html')), 'Companion file requested')
    report.topics.push({ topic, counts, baseline: 'current HTML', noJavaScriptReadable: true, appendAndReexportPreservesBody: true, directEditAndReexport: true, narrowWidths: [390, 320], errors, externalRequests: [] })
    await context.close()
  }
  await writeFile(path.join(directory, 'results.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
