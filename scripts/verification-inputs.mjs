import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.resolve('vue/compiler-sfc'))
const { parse } = require('@vue/compiler-dom')

function elements(html, source) {
  let tree
  try { tree = parse(html, { parseMode: 'html' }) }
  catch { throw new Error(`${source}：HTML 结构无法解析，请检查标签是否完整闭合。`) }
  const collect = node => (node.children ?? []).flatMap(child => [child, ...collect(child)])
  return collect(tree).filter(node => node.type === 1)
}
const attribute = (node, name) => node.props.find(prop => prop.type === 6 && prop.name.toLowerCase() === name)

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
