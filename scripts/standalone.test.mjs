import { createFixture } from './test-fixture.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { assertStandaloneResources } from './standalone-validation.mjs'
import { extractDiagramExample, extractInteractionScript } from './verification-inputs.mjs'

// Markdown rendering normalizes CRLF to LF; retain every other SVG character.
const normalizeLineEndings = text => text.replace(/\r\n/g, '\n')

test('runtime bundles include only current experiment islands and re-export rechecks the edited body', async t => {
  const { fixture, cleanup } = await createFixture()
  t.after(cleanup)
  const topics = {
    native: '',
    'native-again': '',
    omics: '<OmicsLab mode="tpm" />',
    computer: '<ComputerLab mode="bits" />',
    gradient: '<GradientDemo />',
    mixed: '<OmicsLab mode="tpm" />\n\n<ComputerLab mode="bits" />\n\n<GradientDemo />',
  }
  for (const [topic, component] of Object.entries(topics)) {
    const source = path.join(fixture, 'content', topic)
    await mkdir(source, { recursive: true })
    await writeFile(path.join(source, 'manifest.json'), JSON.stringify({ topic, title: topic, output: `${topic}.html`, chapters: ['one.md'] }))
    await writeFile(path.join(source, 'one.md'), `## ${topic}\n\nEditable static paragraph.\n\n${component}\n`)
  }
  const build = (...topics) => execFileSync(process.execPath, ['scripts/build-standalone.mjs', ...topics], { cwd: fixture, stdio: 'pipe' })
  build(...Object.keys(topics))
  const documents = Object.fromEntries(await Promise.all(Object.keys(topics).map(async topic => [topic, await readFile(path.join(fixture, 'dist', `${topic}.html`), 'utf8')])))
  const scripts = Object.fromEntries(Object.entries(documents).map(([topic, html]) => [topic, extractInteractionScript(html)]))
  const signatures = { omics: 'RNA-seq', computer: 'binary32', gradient: '链式法则' }
  for (const [topic, script] of Object.entries(scripts)) {
    assertStandaloneResources(documents[topic])
    for (const [component, signature] of Object.entries(signatures)) {
      assert.equal(script.includes(signature), topic === component || topic === 'mixed', `${topic} unexpectedly includes or omits ${component}`)
    }
  }
  assert.equal(scripts.native, scripts['native-again'], 'Equal component sets should share identical runtime bundles')
  assert.doesNotMatch(scripts.native, /__vueParentComponent/)
  // Shared reader tools are present in every book; compare the omitted experiment payload.
  // Both now include the offline TeX engine for reader-authored notes.
  assert.ok(Buffer.byteLength(scripts.native) < 2_000_000, 'Shared reading and formula tools exceeded the offline runtime budget')
  assert.ok(Buffer.byteLength(scripts.mixed) - Buffer.byteLength(scripts.native) > 60_000, 'Experiment-free output must omit the experiment payload')
  t.diagnostic(JSON.stringify({ runtimeBytes: Object.fromEntries(Object.entries(scripts).map(([topic, script]) => [topic, Buffer.byteLength(script)])) }))
  const nativeStyles = documents.native.match(/<style id="course-design-system">([\s\S]*?)<\/style>/)[1]
  assert.doesNotMatch(nativeStyles, /data-v-/)
  const body = html => html.match(/<!-- course:body:start -->\n([\s\S]*?)\n<!-- course:body:end -->/)[1]
  const target = path.join(fixture, 'dist/native.html')
  const islandContent = documents.omics.match(/<article class="vp-doc">([\s\S]*?)<\/article>/)[1]
    .replace('data-course-component="OmicsLab"', 'DATA-COURSE-COMPONENT="Omics&#76;ab"')
  const edited = documents.native.replace('</article>', islandContent + '</article>')
  await writeFile(target, edited)
  build('native')
  const repacked = await readFile(target, 'utf8')
  assert.equal(body(repacked), body(edited))
  assert.equal(extractInteractionScript(repacked), scripts.omics, 'Adding an island directly in HTML must add its runtime')
  await writeFile(target, documents.native)
  build('native')
  const withoutIsland = await readFile(target, 'utf8')
  assert.equal(body(withoutIsland), body(documents.native))
  assert.equal(extractInteractionScript(withoutIsland), scripts.native, 'Removing all islands must remove the experiment runtime')
})

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
    '<svg><path marker-end="url(arrows.svg#tip)"/></svg>',
    '<svg><rect fill="url(gradient.svg#paint)"/></svg>',
    '<svg><g clip-path="url(clips.svg#shape)"/></svg>',
    '<svg><g filter="url(filters.svg#blur)"/></svg>',
    '<svg><use xlink:href="icons.svg#dot"/></svg>',
    '<svg><image><animate attributeName="href" values="#local;remote.svg"/></image></svg>',
    '<svg><path><set attributeName="marker-end" to="url(remote.svg#tip)"/></path></svg>',
    '<link href=theme.css rel=stylesheet>', '<script src=app.js></script>',
    '<iframe srcdoc="remote content"></iframe>',
  ]
  for (const html of external) assert.throws(() => assertStandaloneResources(html), /External resource reference/, html)
  assertStandaloneResources(`<a href="https://example.org/paper">Reference</a>
    <img src='data:image/png;base64,AAAA' srcset="data:image/png;base64,AAAA 1x, data:image/png;base64,BBBB 2x">
    <svg><use xlink:href="#glyph"/></svg>
    <svg><path marker-end="url(#tip)" fill="var(--accent)" stroke="currentColor"/><g clip-path="url(#clip)"/>
      <circle><animate attributeName="fill" values="var(--accent);var(--accent-2)"/></circle></svg>
    <div style="background:url('data:image/png;base64,AAAA')"></div>
    <style>p{filter:url(#filter)}</style>
    <pre>&lt;img src="example.png"&gt;</pre>
    <script>const sample = '<img src="example.png">';</script>`)
})

test('native SVG import preserves the complete example with LF and CRLF source files', async t => {
  const { fixture, cleanup } = await createFixture()
  t.after(cleanup)
  const source = path.join(fixture, 'content', 'svg-newlines')
  const guide = await readFile(new URL('../handbook/authoring.md', import.meta.url), 'utf8')
  const diagram = normalizeLineEndings(extractDiagramExample(guide))
  await mkdir(source, { recursive: true })
  await writeFile(path.join(source, 'manifest.json'), JSON.stringify({ topic: 'svg-newlines', title: 'SVG newlines', output: 'svg-newlines.html', chapters: ['one.md'] }))
  for (const ending of ['\n', '\r\n']) {
    await writeFile(path.join(source, 'one.md'), ('## SVG example\n\n' + diagram + '\n').replaceAll('\n', ending))
    execFileSync(process.execPath, ['scripts/build-standalone.mjs', 'svg-newlines', '--from-markdown'], { cwd: fixture, stdio: 'pipe' })
    const html = await readFile(path.join(fixture, 'dist', 'svg-newlines.html'), 'utf8')
    const exported = html.match(/<figure data-course-animation>[\s\S]*?<\/figure>/)?.[0]
    assert.ok(exported, 'Exported SVG example is missing')
    assert.equal(normalizeLineEndings(exported), diagram, `SVG content changed for ${JSON.stringify(ending)} source`)
  }
})

test('real exporter assigns book-wide anchors and preserves human revisions and appended content', async t => {
  const { fixture, cleanup } = await createFixture()
  t.after(cleanup)
  assert.throws(() => execFileSync(process.execPath, ['scripts/verify-native-html.mjs'], { cwd: fixture, stdio: 'pipe' }), error => /未找到 dist/.test(String(error.stderr)) && !/ENOENT/.test(String(error.stderr)))
  assert.throws(() => execFileSync(process.execPath, ['scripts/build-standalone.mjs', '--all'], { cwd: fixture, stdio: 'pipe' }), error => /没有已有主题/.test(String(error.stderr)))
  const source = path.join(fixture, 'content', 'regression')
  const guide = await readFile(new URL('../handbook/authoring.md', import.meta.url), 'utf8')
  const diagram = extractDiagramExample(guide)
  await mkdir(source, { recursive: true })
  await writeFile(path.join(source, 'manifest.json'), JSON.stringify({ topic: 'regression', title: 'Regression', output: 'regression.html', chapters: ['one.md', 'two.md'] }))
  await writeFile(path.join(source, 'one.md'), '## Summary\n\nFirst chapter.\n\n### Mechanism\n\nDetail.\n\n#### Edge case\n\nDeeper detail.\n\n<section class="explorer"><h3 id="lab-silent">Not a chapter</h3><p>Experiment.</p></section>\n\n$x^2$\n\n$$\nx < y\n$$\n')
  await writeFile(path.join(source, 'two.md'), '## Summary\n\nSecond chapter.\n\n$x^3$\n\n' + diagram + '\n')
  const build = (...args) => execFileSync(process.execPath, ['scripts/build-standalone.mjs', ...(args.length ? args : ['regression'])], { cwd: fixture, stdio: 'pipe' })
  build()
  const target = path.join(fixture, 'dist', 'regression.html')
  const original = await readFile(target, 'utf8')
  assert.ok(normalizeLineEndings(original).includes(normalizeLineEndings(diagram)), 'Exporter must preserve the documented native SVG example (apart from CRLF/LF normalization)')
  assert.match(original, /data-course-animation-controls hidden/)
  assert.throws(() => execFileSync(process.execPath, ['scripts/verify-native-html.mjs', '.'], { cwd: fixture, stdio: 'pipe' }), error => /直接包含 playwright\/ 的 node_modules 目录/.test(String(error.stderr)))
  assert.equal([...original.matchAll(/<mjx-container data-tex=/g)].length, 3, 'Every inline and block formula needs source TeX')
  assert.match(original, /data-tex="x &lt; y\n"/)
  assert.equal([...original.matchAll(/<mjx-container\b/g)].length, 3)
  assert.match(original, /<html lang="zh-CN">/)
  const ids = [...original.matchAll(/<h2 id="([^"]+)"/g)].map(match => match[1])
  assert.equal(ids.length, 2)
  assert.equal(new Set(ids).size, 2, 'Duplicate chapter anchors')
  for (const id of ids) assert.ok(original.includes(`<a href="#${id}">`), `Missing navigation for ${id}`)
  assert.match(original, /<details class="outline-branch"><summary><a href="#summary">/)
  assert.match(original, /href="#mechanism"/)
  assert.match(original, /href="#edge-case"/)
  assert.doesNotMatch(original, /href="#lab-silent"/)
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
  const body = html => {
    const match = html.match(/<!-- course:body:start -->\r?\n([\s\S]*?)\r?\n<!-- course:body:end -->/)
    assert.ok(match, '导出回归 HTML 缺少 course:body:start/end 正文保护标记')
    return match[1]
  }
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
  for (const malformed of [
    '',
    beforeMalformed.replace('<!-- course:body:end -->', ''),
    beforeMalformed.replace('</article>', '<!-- course:body:end -->\n<p>Must not be discarded</p></article>'),
    beforeMalformed.replace('<article', '<!-- course:body:start -->\n<article'),
    beforeMalformed.replace(/<!-- course:body:(start|end) -->/g, (_, side) => `<!-- course:body:${side === 'start' ? 'end' : 'start'} -->`),
  ]) {
    await writeFile(target, malformed)
    assert.throws(() => build(), error => /正文保护标记/.test(String(error.stderr)))
    assert.equal(await readFile(target, 'utf8'), malformed, 'Ambiguous or empty HTML must not be overwritten')
  }
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
  for (const [snippet, message] of [
    ['<style>p{color:red}</style>', /不允许 <style>/],
    ['<div>\n<style>p{color:red}</style>\n</div>', /不允许 <style>/],
    ['<B>Example</B>', /仅允许小写/],
  ]) {
    await writeFile(path.join(source, 'one.md'), '## Authoring validation\n\n' + snippet)
    const before = await readFile(target, 'utf8')
    assert.throws(() => build('regression', '--from-markdown'), error => message.test(String(error.stderr)))
    assert.equal(await readFile(target, 'utf8'), before, 'Invalid author input overwrote current HTML')
  }
  await writeFile(path.join(source, 'one.md'), '## A & B < C\n\n<CoursePanel title="Say &quot;hello&quot; &amp; goodbye">\n\nPanel text.\n\n</CoursePanel>\n\n<OmicsLab mode="tpm" />\n\n<ComputerLab mode="bits" />\n\n<GradientDemo />\n\n```html\n<B>Example</B>\n<style>p{color:red}</style>\n```')
  build('regression', '--from-markdown')
  const valid = await readFile(target, 'utf8')
  assert.match(valid, /Say &quot;hello&quot; &amp; goodbye/)
  assert.match(valid, /data-course-component="OmicsLab"/)
  assert.match(valid, /A &amp; B &lt; C/)
  assert.doesNotMatch(valid, /A &amp;amp;/)
  // Build site mode from synthetic data; no private textbook is needed.
  await writeFile(path.join(fixture, 'docs/index.md'), '# Verification\n\n$x^2$\n\n$$\nx < y\n$$\n\n<OmicsLab mode="tpm" />\n\n<ComputerLab mode="bits" />\n\n<GradientDemo />')
  execFileSync(process.execPath, ['scripts/build-site.mjs'], { cwd: fixture, stdio: 'pipe' })
  const site = await readFile(path.join(fixture, 'docs/.vitepress/dist/index.html'), 'utf8')
  assert.match(site, /Counts 与 TPM/)
  assert.match(site, /同一组位，两种整数解释/)
  assert.equal([...site.matchAll(/<mjx-container\b/g)].length, 2, 'Site mode must actually render inline and block math')

  // Two topics in a single process exercise the cached Markdown renderer's locale.
  const localizedTopics = ['locale-en', 'locale-zh']
  for (const [index, topic] of localizedTopics.entries()) {
    const folder = path.join(fixture, 'content', topic)
    await mkdir(folder, { recursive: true })
    await writeFile(path.join(folder, 'manifest.json'), JSON.stringify({ topic, title: topic, lang: index ? 'zh-CN' : 'en', output: `${topic}.html`, chapters: ['one.md'] }))
    await writeFile(path.join(folder, 'one.md'), '## Contents\n\n$x^2$\n\n| A | B |\n| - | - |\n| 1 | 2 |\n')
  }
  build(...localizedTopics)
  const englishPath = path.join(fixture, 'dist/locale-en.html')
  const english = await readFile(englishPath, 'utf8')
  assert.match(english, /<html lang="en">/)
  assert.match(english, /data-collapse-label="Collapse contents"/)
  assert.match(english, /aria-label="Scrollable data table"/)
  const chinese = await readFile(path.join(fixture, 'dist/locale-zh.html'), 'utf8')
  assert.match(chinese, /aria-label="可横向滚动的数据表"/)
  assert.match(chinese, /data-collapse-label="收起目录"/)
  const editedLocale = english.replace('<html lang="en">', "<html lang='fr'>").replace('data-expand-label="Expand contents"', 'data-expand-label="Custom contents"')
  await writeFile(englishPath, editedLocale)
  build('locale-en')
  const repacked = await readFile(englishPath, 'utf8')
  assert.match(repacked, /<html lang="fr">/)
  assert.equal(body(repacked), body(editedLocale), 'Locale changes must not rewrite the authoritative body')

})
