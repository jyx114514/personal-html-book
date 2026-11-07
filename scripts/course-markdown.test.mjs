import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMarkdownRenderer } from 'vitepress'
import { courseMarkdown } from './course-markdown.mjs'
import { normalizeGene, parseDna, reverseComplement, selectedSequence, renderGeneViewer } from '../docs/.vitepress/theme/gene-model.mjs'
import { planCircularMap } from '../docs/.vitepress/theme/gene-map.mjs'

test('CJK strong emphasis works in prose, lists, tables and HTML panels without changing code or attributes', async () => {
  const md = await createMarkdownRenderer(process.cwd(), { math: true })
  md.use(courseMarkdown)
  for (const source of ['这是**关键结论。**后文', '**注意：**不要忽略', '中文**（重点）**连续', '- **注意：**后文', '| 要点 |\n| --- |\n| **结论：**后文 |', '<div class="box" title="**原属性**">**结论：**后文</div>', '<CoursePanel title="提示">\n**结论：**后文\n</CoursePanel>']) {
    assert.match(md.render(source), /<strong>[^<]+<\/strong>/, source)
  }
  assert.match(md.render('<div title="**attribute**"><span data-x="manual">**内容**</span><code>**literal**</code></div>'), /title="\*\*attribute\*\*"><span data-x="manual"><strong>内容<\/strong><\/span><code>\*\*literal\*\*<\/code>/)
  assert.match(md.render('`**literal**`'), /<code>\*\*literal\*\*<\/code>/)
  assert.doesNotMatch(md.render('```text\n**literal**\n```'), /<strong>/)
  assert.match(md.render(String.raw`\*\*literal\*\*`), /\*\*literal\*\*/)
  assert.doesNotMatch(md.render('**unfinished'), /<strong>/)
  assert.match(md.render('**outer *inner* end**'), /<strong>outer <em>inner<\/em> end<\/strong>/)
  assert.match(md.render('$x^{**}$'), /data-tex|mjx-container/)
})

test('gene coordinates, FASTA, circular origin and all IUPAC complements are validated', () => {
  assert.equal(parseDna('>demo\nacgt\nNRY'), 'ACGTNRY')
  assert.equal(reverseComplement('ACGTRYSWKMBDHVN'), 'NBDHVKMWSRYACGT')
  assert.equal(selectedSequence('ACGTTA', 5, 2), 'TAAC')
  const data = { sequence: 'ACGTTA', features: [{ name: 'wrap', start: 5, end: 2, strand: -1 }] }
  assert.equal(normalizeGene(data).features[0].strand, -1)
  assert.throws(() => normalizeGene({ ...data, topology: 'linear' }), /坐标/)
  for (const bad of ['ACGX', '>one\nACGT\n>two\nACGT', '', 'A'.repeat(50001)]) assert.throws(() => parseDna(bad), /gene-viewer/)
  for (const changes of [{ features: [{ name: 'bad', start: 0, end: 3 }] }, { topology: 'bad' }, { features: [{ name: 'bad', start: 1, end: 2, strand: 3 }] }]) assert.throws(() => normalizeGene({ ...data, ...changes }), /gene-viewer/)
  const nondirectional = { ...data, features: [{ name: 'Undirected', start: 1, end: 2, strand: 0 }] }
  assert.equal(normalizeGene(nondirectional).features[0].strand, 0)
  assert.doesNotMatch(renderGeneViewer(nondirectional), /class="gene-arrow"/)
  assert.match(renderGeneViewer(nondirectional), /无方向/)
  const html = renderGeneViewer({ ...data, name: '<script>alert(1)</script>' })
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /data-gene-raw>ACGTTA/)
  assert.throws(() => normalizeGene({ ...data, features: [{ name: 'bad color', start: 1, end: 3, color: 'url(remote)' }] }), /color/)
})

test('detailed maps separate overlapping ranges, preserve circular spans and place dense labels without overlap', () => {
  const gene = normalizeGene({ name: 'Dense map', sequence: 'A'.repeat(8000), features: [
    { name: 'wrap', start: 7800, end: 200, color: '#00ff00' },
    { name: 'overlap', start: 7900, end: 100 },
    ...Array.from({ length: 55 }, (_, i) => ({ name: `Site ${i}`, start: 1400 + i * 4, end: 1402 + i * 4, strand: 0 })),
  ] })
  const plan = planCircularMap(gene)
  assert.equal(plan.records[0].size, 401)
  assert.notEqual(plan.records[0].lane, plan.records[1].lane)
  for (const side of ['left', 'right']) {
    const labels = plan.records.filter(record => !record.inside && record.side === side).sort((a, b) => a.labelY - b.labelY)
    for (let i = 1; i < labels.length; i++) assert.ok(labels[i].labelY - labels[i - 1].labelY >= 32)
    assert.ok(labels.every(label => label.labelY >= 50 && label.labelY <= plan.height - 50))
  }
  const first = renderGeneViewer(gene), second = renderGeneViewer(gene)
  assert.equal([...first.matchAll(/data-gene-map-label=/g)].length, gene.features.length)
  assert.match(first, /fill="#00ff00"/)
  assert.doesNotMatch(first, /NaN|Infinity/)
  const firstIds = new Set([...first.matchAll(/ id="([^"]+)"/g)].map(match => match[1]))
  assert.ok([...second.matchAll(/ id="([^"]+)"/g)].every(match => !firstIds.has(match[1])), 'Map label references must be unique across instances')
})
