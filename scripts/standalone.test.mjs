import { createFixture } from './test-fixture.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { assertStandaloneResources } from './standalone-validation.mjs'

test('resource validation rejects external HTML/CSS resources regardless of quoting', () => {
  const external = [
    '<form action=remote></form>', '<button formaction=remote>Send</button>', '<meta property=og:image content=remote>', '<img longdesc=remote>',
    `<img src='figure.png'>`, '<img SRC = figure.png>', '<img src="&#102;igure.png">',
    '<div style="background-image:url(figure.png)"></div>',
    `<style>p{background: url('figure.png')}</style>`,
    '<style>@import "theme.css";</style>',
    '<style>p{background:u\\72l(figure.png)}</style>',
    `<style>p{background:image-set('figure.png' 1x)}</style>`,
    '<img srcset="data:image/png;base64,AAAA 1x, figure.png 2x">',
    '<svg><image href="figure.svg"/></svg>', '<video poster=figure.png></video>',
    '<link href=theme.css rel=stylesheet>', '<script src=app.js></script>',
    '<iframe srcdoc="remote content"></iframe>',
  ]
  for (const html of external) assert.throws(() => assertStandaloneResources(html), /External resource reference/, html)
  assertStandaloneResources(`<a href="https://example.org/paper">Reference</a>
    <img src='data:image/png;base64,AAAA' srcset="data:image/png;base64,AAAA 1x, data:image/png;base64,BBBB 2x">
    <svg><use xlink:href="#glyph"/></svg>
    <div style="background:url('data:image/png;base64,AAAA')"></div>
    <style>p{filter:url(#filter)}</style>
    <pre>&lt;img src="example.png"&gt;</pre>
    <script>const sample = '<img src="example.png">';</script>`)
})

test('real exporter assigns book-wide anchors and preserves human revisions and appended content', async t => {
  const { fixture, cleanup } = await createFixture()
  t.after(cleanup)
  assert.throws(() => execFileSync(process.execPath, ['scripts/verify-native-html.mjs'], { cwd: fixture, stdio: 'pipe' }), error => /未找到 dist/.test(String(error.stderr)) && !/ENOENT/.test(String(error.stderr)))
  assert.throws(() => execFileSync(process.execPath, ['scripts/build-standalone.mjs', '--all'], { cwd: fixture, stdio: 'pipe' }), error => /没有已有主题/.test(String(error.stderr)))
  const source = path.join(fixture, 'content', 'regression')
  await mkdir(source, { recursive: true })
  await writeFile(path.join(source, 'manifest.json'), JSON.stringify({ topic: 'regression', title: 'Regression', output: 'regression.html', chapters: ['one.md', 'two.md'] }))
  await writeFile(path.join(source, 'one.md'), '## Summary\n\nFirst chapter.\n\n$x^2$\n')
  await writeFile(path.join(source, 'two.md'), '## Summary\n\nSecond chapter.\n\n$x^3$\n')
  const build = (...args) => execFileSync(process.execPath, ['scripts/build-standalone.mjs', ...(args.length ? args : ['regression'])], { cwd: fixture, stdio: 'pipe' })
  build()
  const target = path.join(fixture, 'dist', 'regression.html')
  const original = await readFile(target, 'utf8')
  const ids = [...original.matchAll(/<h2 id="([^"]+)"/g)].map(match => match[1])
  assert.equal(ids.length, 2)
  assert.equal(new Set(ids).size, 2, 'Duplicate chapter anchors')
  for (const id of ids) assert.ok(original.includes(`<li><a href="#${id}">`), `Missing navigation for ${id}`)
  const revised = original.replace('First chapter.', 'Human revision that must survive.')
  const end = revised.lastIndexOf('</article>')
  const appended = revised.slice(0, end) + '<h2 id="appended">Appended chapter</h2>\n<p>New material.</p>\n' + revised.slice(end)
  assert.equal(appended.slice(0, end), revised.slice(0, end))
  await writeFile(target, appended)
  // Neither stale Markdown nor an unrelated legacy backup may replace current HTML.
  await writeFile(path.join(source, 'one.md'), '## Stale source\n\nDo not restore this.')
  await mkdir(path.join(fixture, 'internal/html-export-backups/legacy'), { recursive: true })
  await writeFile(path.join(fixture, 'internal/html-export-backups/legacy/regression.html'), '<article>Obsolete content</article>')
  build()
  const refreshed = await readFile(target, 'utf8')
  const body = html => html.match(/<!-- course:body:start -->\r?\n([\s\S]*?)\r?\n<!-- course:body:end -->/)[1]
  assert.equal(body(refreshed), body(appended), 'Resource refresh changed revised or appended body')
  const invalid = refreshed.replace('</article>', "<img src='missing.png'></article>")
  await writeFile(target, invalid)
  assert.throws(() => build(), error => /External resource reference/.test(String(error.stderr)))
  assert.equal(await readFile(target, 'utf8'), invalid, 'Failed build overwrote the authoritative HTML')
  await writeFile(target, refreshed.replace(/<!-- course:body:start -->\r?\n/, '<!-- course:body:start -->').replace(/\r?\n<!-- course:body:end -->/, '<!-- course:body:end -->'))
  build('--all')
  assert.match(await readFile(target, 'utf8'), /Human revision that must survive/)
  const beforeImport = await readFile(target, 'utf8')
  build('regression', '--from-markdown')
  const backupRoot = path.join(fixture, 'internal/html-export-backups')
  const saved = await Promise.all((await readdir(backupRoot)).filter(name => name !== 'legacy').map(name => readFile(path.join(backupRoot, name, 'regression.html'), 'utf8')))
  assert.ok(saved.includes(beforeImport), 'Markdown reimport did not back up current HTML')
  assert.match(await readFile(target, 'utf8'), /Stale source/)

  assert.doesNotMatch(await readFile(target, 'utf8'), /Human revision that must survive/)
  const beforeMalformed = await readFile(target, 'utf8')
  const malformed = beforeMalformed.replace('<!-- course:body:end -->', '')
  await writeFile(target, malformed)
  assert.throws(() => build(), error => /正文保护标记/.test(String(error.stderr)))
  assert.equal(await readFile(target, 'utf8'), malformed)
  await writeFile(target, beforeMalformed)
  const backups = await readdir(path.join(fixture, 'internal/html-export-backups'))
  assert.ok(backups.length >= 4)
  for (const [args, message] of [[['../escape'], /Invalid topic/], [['missing'], /manifest.json/], [['--unknown'], /Unknown option/]]) {
    assert.throws(() => build(...args), error => message.test(String(error.stderr)))
  }
  for (const component of ['<OmicsLab />', '<ComputerLab mode="bad" />', '<ComputerLab mode="bits-typo" />']) {
    await writeFile(path.join(source, 'one.md'), '## Mode validation\n\n' + component)
    const before = await readFile(target, 'utf8')
    assert.throws(() => build('regression', '--from-markdown'), error => /Invalid mode/.test(String(error.stderr)))
    assert.equal(await readFile(target, 'utf8'), before)
  }
  await writeFile(path.join(source, 'one.md'), '## A & B < C\n\n<CoursePanel title="Say &quot;hello&quot; &amp; goodbye">\n\nPanel text.\n\n</CoursePanel>\n\n<OmicsLab mode="tpm" />\n\n<ComputerLab mode="bits" />\n\n<GradientDemo />')
  build('regression', '--from-markdown')
  const valid = await readFile(target, 'utf8')
  assert.match(valid, /Say &quot;hello&quot; &amp; goodbye/)
  assert.match(valid, /data-course-component="OmicsLab"/)
  assert.match(valid, /A &amp; B &lt; C/)
  assert.doesNotMatch(valid, /A &amp;amp;/)
  // Build site mode from synthetic data; no private textbook is needed.
  await writeFile(path.join(fixture, 'docs/index.md'), '# Verification\n\n<OmicsLab mode="tpm" />\n\n<ComputerLab mode="bits" />\n\n<GradientDemo />')
  execFileSync(process.execPath, ['scripts/build-site.mjs'], { cwd: fixture, stdio: 'pipe' })
  const site = await readFile(path.join(fixture, 'docs/.vitepress/dist/index.html'), 'utf8')
  assert.match(site, /Counts 与 TPM/)
  assert.match(site, /同一组位，两种整数解释/)

})
