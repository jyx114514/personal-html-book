import { createRequire } from 'node:module'
import { renderGeneViewer } from '../docs/.vitepress/theme/gene-model.mjs'

const require = createRequire(import.meta.resolve('vue/compiler-sfc'))
const { parse } = require('@vue/compiler-dom')
const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
const punctuation = /[\p{P}\p{S}]/u

// Keep markdown-it's delimiter pairing, escapes, nesting and code handling.
// Relax only double-star punctuation boundaries beside CJK prose.
export function courseMarkdown(md) {
  md.inline.ruler.before('emphasis', 'course-cjk-strong', state => {
    if (!state.courseDelimiters) {
      state.courseDelimiters = true
      const scan = state.scanDelims
      state.scanDelims = function (start, split) {
        const result = scan.call(this, start, split)
        if (this.src[start] !== '*' || result.length !== 2) return result
        const before = this.src[start - 1] ?? ' '
        const after = this.src[start + 2] ?? ' '
        if (cjk.test(before) && punctuation.test(after)) result.can_open = true
        if (punctuation.test(before) && cjk.test(after)) result.can_close = true
        return result
      }
    }
    return false
  })

  // Markdown normally treats an entire <div> as an opaque HTML block. Render
  // emphasis in its prose text nodes only; never rewrite attributes or code.
  const htmlBlock = md.renderer.rules.html_block
  md.renderer.rules.html_block = (tokens, index, options, env, self) => {
    const source = tokens[index].content
    if (!source.includes('**')) return htmlBlock ? htmlBlock(tokens, index, options, env, self) : source
    const edits = []
    const protectedTags = /^(pre|code|script|style|textarea|svg|math|mjx-container)$/i
    function walk(node, protectedText = false) {
      const blocked = protectedText || protectedTags.test(node.tag ?? '')
      if (!blocked && node.type === 2 && node.loc.source.includes('**')) {
        edits.push({ start: node.loc.start.offset, end: node.loc.end.offset, text: md.renderInline(node.loc.source, env) })
      }
      for (const child of node.children ?? []) walk(child, blocked)
    }
    walk(parse(source, { parseMode: 'html' }))
    return edits.sort((a, b) => b.start - a.start).reduce((html, edit) => html.slice(0, edit.start) + edit.text + html.slice(edit.end), source)
  }

  const fence = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, index, ...args) => {
    if (tokens[index].info.trim() !== 'gene-viewer') return fence(tokens, index, ...args)
    let data
    try { data = JSON.parse(tokens[index].content) }
    catch { throw new Error('gene-viewer: 需要合法的 JSON 序列与注释数据') }
    return renderGeneViewer(data)
  }
}
