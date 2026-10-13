import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertStandaloneResources } from './standalone-validation.mjs'

test('resource validation rejects external HTML/CSS resources regardless of quoting', () => {
  const external = [
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

test('real exporter assigns book-wide anchors and preserves human revisions and appended content', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const internal = path.join(root, 'internal')
  await mkdir(internal, { recursive: true })
  // Keep fixtures in the ignored private directory; never rewrite delivered textbooks.
  const fixture = await mkdtemp(path.join(internal, 'standalone-regression-'))
  for (const entry of ['scripts', 'standalone', 'docs/.vitepress/theme', 'package.json']) {
    await cp(path.join(root, entry), path.join(fixture, entry), { recursive: true })
  }
  await symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  const source = path.join(fixture, 'content', 'regression')
  await mkdir(source, { recursive: true })
  await writeFile(path.join(source, 'manifest.json'), JSON.stringify({ topic: 'regression', title: 'Regression', output: 'regression.html', chapters: ['one.md', 'two.md'] }))
  await writeFile(path.join(source, 'one.md'), '## Summary\n\nFirst chapter.\n\n$x^2$\n')
  await writeFile(path.join(source, 'two.md'), '## Summary\n\nSecond chapter.\n\n$x^3$\n')
  const build = () => execFileSync(process.execPath, ['scripts/build-standalone.mjs', 'regression'], { cwd: fixture, stdio: 'pipe' })
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
  assert.throws(build, error => /External resource reference/.test(String(error.stderr)))
  assert.equal(await readFile(target, 'utf8'), invalid, 'Failed build overwrote the authoritative HTML')
})
