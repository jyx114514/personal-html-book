import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { outlineExcludedClasses } from '../docs/.vitepress/theme/outline-model.mjs'

const require = createRequire(import.meta.resolve('vue/compiler-sfc'))
const { parse } = require('@vue/compiler-dom')

function parseDocument(html, source) {
  try { return parse(html, { parseMode: 'html' }) }
  catch { throw new Error(`${source}：HTML 结构无法解析，请检查标签是否完整闭合。`) }
}
function elements(html, source) {
  const tree = parseDocument(html, source)
  const collect = node => (node.children ?? []).flatMap(child => [child, ...collect(child)])
  return collect(tree).filter(node => node.type === 1)
}
const attribute = (node, name) => node.props.find(prop => prop.type === 6 && prop.name.toLowerCase() === name)

export function assertNativeStructure(html, source = '独立 HTML') {
  const nodes = elements(html, source)
  const classes = node => attribute(node, 'class')?.value?.content.split(/\s+/) ?? []
  const inside = (node, parent) => node.loc.start.offset >= parent.loc.start.offset && node.loc.end.offset <= parent.loc.end.offset
  const articles = nodes.filter(node => node.tag.toLowerCase() === 'article' && classes(node).includes('vp-doc'))
  assert.equal(articles.length, 1, `${source} 必须包含唯一的 article.vp-doc 静态正文。`)
  const article = articles[0]
  assert.ok(nodes.some(node => node.tag.toLowerCase() === 'p' && inside(node, article)), `${source} 的静态正文缺少段落。`)
  const ids = new Map()
  for (const node of nodes) {
    const id = attribute(node, 'id')?.value?.content
    if (!id) continue
    assert.ok(!ids.has(id), `${source} 包含重复 ID：${id}`)
    ids.set(id, node)
  }
  const nav = ids.get('course-outline-links')
  assert.ok(nav?.tag.toLowerCase() === 'nav', `${source} 缺少 nav#course-outline-links 教材目录。`)
  const excluded = nodes.filter(node => attribute(node, 'data-course-component') ||
    attribute(node, 'data-course-outline')?.value?.content === 'exclude' || classes(node).some(name => outlineExcludedClasses.includes(name)))
  for (const link of nodes.filter(node => node.tag.toLowerCase() === 'a' && inside(node, nav))) {
    const href = attribute(link, 'href')?.value?.content ?? ''
    assert.ok(href.startsWith('#') && href.length > 1, `${source} 包含无效目录链接：${href}`)
    let id = href.slice(1)
    try { id = decodeURIComponent(id) } catch { /* Match the runtime's literal-hash fallback. */ }
    const target = ids.get(id)
    assert.ok(target && inside(target, article) && !excluded.some(node => inside(target, node)), `${source} 的目录链接没有公开正文目标：${href}`)
  }
}

export function assertNoPrivateReferences(html, source = '独立 HTML') {
  function inspect(value) {
    assert.ok(!/chatgpt\.com\/share|\b[a-z]:[\/\\]|(?:\/home\/|\/Users\/)[^\s<>/]+\/|turn\d+(search|view)/i.test(value), `${source} 包含本地路径、原始对话链接或内部引用标识。`)
    // Public reference URLs may legitimately contain /sources/ or /internal/.
    const local = value.replace(/(?:\b(?:https?|ftp):)?\/\/[^\s<>"'`]+/gi, '')
    assert.ok(!/(?:^|[^a-z0-9_-])(?:sources|internal)[\/\\]/i.test(local), `${source} 包含 sources/ 或 internal/ 私有材料路径。`)
  }
  function visit(node) {
    if (typeof node.content === 'string') inspect(node.content)
    for (const prop of node.props ?? []) if (prop.type === 6 && prop.value) inspect(prop.value.content)
    for (const child of node.children ?? []) visit(child)
  }
  visit(parseDocument(html, source))
}

export function extractDiagramExample(guide, source = 'handbook/authoring.md') {
  const examples = []
  // Find HTML fences first; parse attributes rather than depending on one opening-tag layout.
  for (const [, , html] of guide.matchAll(/^ {0,3}(`{3,}|~{3,})html[\t ]*\r?\n([\s\S]*?)^ {0,3}\1[\t ]*(?:\r?\n|$)/gm)) {
    const nodes = elements(html, `${source} 的 HTML 示例代码块`)
    if (nodes.some(node => node.tag.toLowerCase() === 'figure' && attribute(node, 'data-course-animation'))) examples.push(html.replace(/\r?\n$/, ''))
  }
  assert.equal(examples.length, 1, `${source} 必须包含唯一的 <figure data-course-animation> HTML 示例代码块；实际找到 ${examples.length} 个，请检查示例和代码围栏。`)
  return examples[0]
}

export function extractInteractionScript(html, source = '独立 HTML') {
  const scripts = elements(html, source).filter(node => node.tag.toLowerCase() === 'script' && attribute(node, 'id')?.value?.content === 'course-interactions')
  assert.equal(scripts.length, 1, `${source} 必须包含唯一的 <script id="course-interactions">；实际找到 ${scripts.length} 个，请检查导出结构。`)
  assert.ok(!attribute(scripts[0], 'src'), `${source} 的 course-interactions 必须是内嵌脚本，不能引用外部 src。`)
  return scripts[0].children.map(node => node.content ?? '').join('')
}

export function stripDiagramAnimation(html) {
  const removals = []
  const remove = loc => {
    let start = loc.start.offset, end = loc.end.offset
    const lineStart = html.lastIndexOf('\n', start - 1) + 1
    const lineEnd = html.indexOf('\n', end)
    if (lineEnd >= 0 && !html.slice(lineStart, start).trim() && !html.slice(end, lineEnd).trim()) {
      start = lineStart
      end = lineEnd + 1
    }
    removals.push({ start, end })
  }
  for (const node of elements(html, '静态图夹具')) {
    if (['animate', 'animatemotion', 'animatetransform', 'set'].includes(node.tag.toLowerCase()) || attribute(node, 'data-course-animation-controls')) remove(node.loc)
    else {
      const marker = attribute(node, 'data-course-animation')
      if (marker) remove(marker.loc)
    }
  }
  for (const { start, end } of removals.sort((a, b) => b.start - a.start)) html = html.slice(0, start) + html.slice(end)
  return html
}

export function parsePrivateTerms(raw) {
  if (raw === undefined) return []
  let terms
  try { terms = JSON.parse(raw) }
  catch { throw new Error('COURSE_PRIVATE_TERMS JSON 解析失败；请设置为合法的 JSON 字符串数组，例如 ["identifier"]，或取消该环境变量。') }
  assert.ok(Array.isArray(terms) && terms.every(term => typeof term === 'string' && term.length > 0), 'COURSE_PRIVATE_TERMS 必须是由非空字符串组成的 JSON 数组，例如 ["identifier"]。')
  return terms
}
