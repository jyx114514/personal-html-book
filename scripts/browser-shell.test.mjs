import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile, readFile, cp } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createFixture } from './test-fixture.mjs'
import { browserRuntime, launchBrowser } from './browser-runtime.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
test('offline shell locales, custom labels, prototype names, and flux endpoints', async t => {
  const runtime = browserRuntime()
  const { fixture, cleanup } = await createFixture()
  t.after(cleanup)
  const topics = ['shell-en', 'shell-zh']
  for (const [index, topic] of topics.entries()) {
    const source = path.join(fixture, 'content', topic)
    await mkdir(source, { recursive: true })
    await writeFile(path.join(source, 'manifest.json'), JSON.stringify({ topic, title: topic, lang: index ? 'zh-CN' : 'en', output: `${topic}.html`, chapters: ['one.md'], validation: { minFormulas: 2 } }))
    await writeFile(path.join(source, 'one.md'), '# Offline shell\n\n## First\n\nStatic paragraph.\n\n### First detail\n\nA subsection.\n\n#### More detail\n\nA deeper subsection.\n\n$x^2$\n\n$$\nx < y\n$$\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```js\nconst x = 1\n```\n\n<OmicsLab mode="flux" />\n\n<section class="explorer"><h3 id="private-lab-title">Embedded experiment</h3><p>Static initial state.</p></section>\n\n## Second\n\nFinal paragraph.\n')
  }
  execFileSync(process.execPath, ['scripts/build-standalone.mjs', ...topics], { cwd: fixture, stdio: 'pipe' })
  // Run the production offline verifier, including no-JS and body preservation.
  execFileSync(process.execPath, ['scripts/verify-native-html.mjs'], { cwd: fixture, stdio: 'pipe' })
  const reportDir = path.join(root, 'internal/test-feedback-browser')
  await cp(path.join(fixture, 'internal/native-html-test'), reportDir, { recursive: true })
  const browser = await launchBrowser(runtime)
  t.after(() => browser.close())
  for (const [index, topic] of topics.entries()) {
    const file = path.join(fixture, 'dist', `${topic}.html`)
    let html = await readFile(file, 'utf8')
    const noJsContext = await browser.newContext({ offline: true, javaScriptEnabled: false })
    const noJs = await noJsContext.newPage()
    await noJs.goto(pathToFileURL(file).href)
    const staticBranch = noJs.locator('aside details.outline-branch').first()
    assert.equal(await noJs.locator('aside a[href="#first-detail"]').isVisible(), false)
    await staticBranch.locator('summary').first().focus()
    await staticBranch.locator('summary').first().press('Enter')
    assert.equal(await noJs.locator('aside a[href="#first-detail"]').isVisible(), true, 'Native details must work without JavaScript')
    await noJsContext.close()
    if (!index) html = html.replace(/(<nav id="course-outline-links"[^>]*>)[\s\S]*?(<\/nav>)/, '$1<ol><li><a href="#first">First</a></li><li><a href="#private-lab-title">Embedded experiment</a></li><li><a href="#second">Second</a></li></ol>$2')
    html = html.replace('</article>', '<div data-course-component="constructor">Constructor placeholder</div>\n<div data-course-component="toString">String placeholder</div>\n</article>')
    await writeFile(file, html)
    const context = await browser.newContext({ offline: true, viewport: { width: 390, height: 844 }, colorScheme: 'light' })
    const page = await context.newPage()
    const errors = [], requests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()) })
    page.on('request', request => requests.push(request.url()))
    await page.goto(pathToFileURL(file).href)
    assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(251, 248, 242)')
    assert.equal(await page.locator('html').getAttribute('lang'), index ? 'zh-CN' : 'en')
    assert.equal(await page.locator('.outline-heading').innerText(), index ? '阅读目录' : 'Contents')
    const toggle = page.locator('.outline-toggle')
    assert.equal(await toggle.innerText(), index ? '展开目录' : 'Expand contents')
    await toggle.click()
    assert.equal(await toggle.innerText(), index ? '收起目录' : 'Collapse contents')
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
    assert.equal(await page.locator('aside nav a').count(), 4, 'Only body chapter/subsection headings belong in the outline')
    assert.equal(await page.locator('aside nav a[href="#private-lab-title"]').count(), 0)
    const branch = page.locator('aside details.outline-branch').first()
    await branch.evaluate(details => { details.open = false })
    await branch.locator('summary').first().focus()
    await branch.locator('summary').first().press('Enter')
    assert.equal(await branch.getAttribute('open'), '')
    const nestedBranch = branch.locator('details.outline-branch')
    await nestedBranch.evaluate(details => { details.open = true })
    await page.locator('aside a[href="#more-detail"]').click()
    assert.equal(await page.locator('aside a[href="#more-detail"]').getAttribute('aria-current'), 'location')
    assert.equal(await page.locator('#more-detail').evaluate(element => document.activeElement === element), true)
    await toggle.click()
    await page.locator('aside nav a').last().click()
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
    assert.equal(await page.locator('.course-table-scroll').getAttribute('aria-label'), index ? '可横向滚动的数据表' : 'Scrollable data table')
    assert.equal(await page.locator('button.copy').getAttribute('aria-label'), index ? '复制代码' : 'Copy code')
    // The shared academic toolbar must stay visible and outside the code area.
    const copyButton = page.locator('button.copy')
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme })
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 844 })
        const toolbar = await copyButton.evaluate(button => {
          const pre = button.parentElement.querySelector('pre')
          const language = button.parentElement.querySelector('.lang')
          return {
            opacity: getComputedStyle(button).opacity,
            position: getComputedStyle(button).position,
            label: getComputedStyle(button, '::before').content,
            aboveCode: button.getBoundingClientRect().bottom <= pre.getBoundingClientRect().top,
            besideLanguage: language.getBoundingClientRect().right <= button.getBoundingClientRect().left,
          }
        })
        assert.equal(toolbar.opacity, '1')
        assert.equal(toolbar.position, 'static')
        assert.equal(toolbar.label, JSON.stringify(index ? '复制代码' : 'Copy code'))
        assert.ok(toolbar.aboveCode, 'Copy toolbar must not cover code')
        assert.ok(toolbar.besideLanguage, 'Language and copy button must not overlap')
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        await copyButton.evaluate(button => button.classList.add('copied'))
        const feedback = await copyButton.evaluate(button => ({
          label: getComputedStyle(button, '::before').content,
          transform: getComputedStyle(button, '::before').transform,
        }))
        assert.equal(feedback.label, JSON.stringify(index ? '已复制' : 'Copied'))
        assert.equal(feedback.transform, 'none', 'Copy feedback must remain inside the button')
        await copyButton.evaluate(button => button.classList.remove('copied'))
      }
    }
    await page.emulateMedia({ colorScheme: 'light' })
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.locator('[data-course-component="constructor"]').innerText(), 'Constructor placeholder')
    assert.equal(await page.locator('[data-course-component="toString"]').innerText(), 'String placeholder')
    const time = page.getByLabel('示踪时间', { exact: true })
    await time.fill('20')
    assert.equal(await page.locator('.omics-lab circle.signal').getAttribute('cx'), '495')
    assert.equal(await page.locator('.omics-lab line.axis').first().getAttribute('x2'), '495')
    assert.equal(await page.locator('.omics-lab svg text').filter({ hasText: '20 min' }).getAttribute('x'), '495')
    assert.deepEqual(errors, [])
    assert.deepEqual(requests.filter(url => /^https?:/.test(url)), [])
    // The runtime must respect labels edited directly in the delivered HTML.
    html = html.replace(/data-expand-label="[^"]*"/, 'data-expand-label="Custom open"')
      .replace(/data-collapse-label="[^"]*"/, 'data-collapse-label="Custom close"')
      .replace('class="copy"', 'class="copy" aria-label="Custom copy"')
    await writeFile(file, html)
    await page.reload()
    assert.equal(await toggle.innerText(), 'Custom open')
    await toggle.click()
    assert.equal(await toggle.innerText(), 'Custom close')
    assert.equal(await page.locator('button.copy').getAttribute('aria-label'), 'Custom copy')
    assert.equal(await copyButton.evaluate(button => getComputedStyle(button, '::before').content), '"Custom copy"')
    assert.deepEqual(errors, [])
    await context.close()
  }
  await writeFile(path.join(reportDir, 'shell-checks.json'), JSON.stringify({ browser: `${runtime.browserName} ${browser.version()}`, topics, offline: true, locales: true, customLabels: true, prototypeNamesIgnored: true, fluxEndpoint: 495, headingHierarchy: true, keyboardSubsectionNavigation: true, noJavaScriptDetails: true, legacyOutlineEnhanced: true, labTitlesExcluded: true }, null, 2))
})
