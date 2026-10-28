import { locateQuote, quoteAnchor, type QuoteAnchor, type ReadingNote } from './annotation-model'

const excluded = 'script, style, template, svg, math, mjx-container, button, input, select, textarea, [contenteditable], [data-course-component], [data-course-outline="exclude"], .explorer, .omics-lab, .computer-lab, .demo, .header-anchor, .course-copy-status, .line-numbers-wrapper'
type TextIndex = { text: string; nodes: { node: Text; start: number; end: number }[] }

function indexText(article: HTMLElement): TextIndex {
  const nodes: TextIndex['nodes'] = []
  let text = ''
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT)
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    if (current.parentElement?.closest(excluded)) continue
    const node = current as Text
    nodes.push({ node, start: text.length, end: text.length + node.length })
    text += node.data
  }
  return { text, nodes }
}

export function selectionAnchor(article: HTMLElement, range: Range): QuoteAnchor | null {
  if (range.collapsed || !article.contains(range.startContainer) || !article.contains(range.endContainer)) return null
  const controls = 'svg, math, mjx-container, button, input, select, textarea, [contenteditable], [data-course-component], .explorer, .omics-lab, .computer-lab, .demo'
  if (Array.from(article.querySelectorAll(controls)).some(node => range.intersectsNode(node))) return null
  const index = indexText(article)
  const selected = index.nodes.filter(({ node }) => range.intersectsNode(node))
  if (!selected.length) return null
  const first = selected[0], last = selected[selected.length - 1]
  const start = first.start + (range.startContainer === first.node ? range.startOffset : 0)
  const end = last.start + (range.endContainer === last.node ? range.endOffset : last.node.length)
  return quoteAnchor(index.text, start, end)
}

export function noteForSelection(article: HTMLElement, anchor: QuoteAnchor, records: ReadingNote[]): ReadingNote | undefined {
  const candidates = records.filter(row => !row.deleted && row.anchor.exact === anchor.exact)
  if (!candidates.length) return
  const text = indexText(article).text, selection = locateQuote(text, anchor)
  if (!selection) return
  // Compare resolved positions: old offsets can move, and equal wording can
  // appear more than once. Prefer an existing note over an older plain mark.
  return candidates.sort((a, b) => Number(!!b.note.trim()) - Number(!!a.note.trim()) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id)).find(row => {
    const position = locateQuote(text, row.anchor)
    return position?.start === selection.start && position.end === selection.end
  })
}

function makeRange(index: TextIndex, start: number, end: number): Range | null {
  const first = index.nodes.find(item => item.end > start)
  const last = [...index.nodes].reverse().find(item => item.start < end)
  if (!first || !last) return null
  const range = document.createRange()
  range.setStart(first.node, start - first.start)
  range.setEnd(last.node, end - last.start)
  return range
}

export function paintNotes(article: HTMLElement, records: ReadingNote[]): Map<string, Range> {
  for (const mark of Array.from(article.querySelectorAll('mark[data-course-note-mark]'))) {
    const parent = mark.parentNode
    mark.replaceWith(...mark.childNodes)
    parent?.normalize()
  }
  const index = indexText(article)
  const resolved = records.filter(row => !row.deleted).flatMap(row => {
    const position = locateQuote(index.text, row.anchor)
    return position ? [{ row, ...position }] : []
  })
  const ranges = new Map<string, Range>()
  for (const item of resolved) {
    const range = makeRange(index, item.start, item.end)
    if (range) ranges.set(item.row.id, range)
  }
  if (typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined') {
    for (const color of ['yellow', 'teal', 'orange', 'blue']) {
      for (const style of ['highlight', 'underline']) {
        const matches = resolved.filter(item => item.row.color === color && item.row.style === style).flatMap(item => ranges.get(item.row.id) ?? [])
        CSS.highlights.set(`course-note-${color}-${style}`, new Highlight(...matches))
      }
    }
    return ranges
  }
  // Older browsers use disposable marks; author files are never rewritten.
  for (const item of index.nodes) {
    const matches = resolved.filter(note => note.start < item.end && note.end > item.start)
    if (!matches.length) continue
    const cuts = [...new Set([0, item.node.length, ...matches.flatMap(note => [Math.max(0, note.start - item.start), Math.min(item.node.length, note.end - item.start)])])].sort((a, b) => a - b)
    const fragment = document.createDocumentFragment()
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i], end = cuts[i + 1]
      const active = matches.filter(note => note.start < item.start + end && note.end > item.start + start).sort((a, b) => b.row.updatedAt - a.row.updatedAt)
      const text = document.createTextNode(item.node.data.slice(start, end))
      if (!active.length) fragment.append(text)
      else {
        const mark = document.createElement('mark')
        mark.dataset.courseNoteMark = active.map(note => note.row.id).join(' ')
        mark.dataset.color = active[0].row.color
        mark.dataset.style = active[0].row.style
        mark.append(text)
        fragment.append(mark)
      }
    }
    item.node.replaceWith(fragment)
  }
  // Splitting text invalidates ranges from the old index; reconstruct for jumping.
  const updated = indexText(article)
  for (const item of resolved) {
    const range = makeRange(updated, item.start, item.end)
    if (range) ranges.set(item.row.id, range)
  }
  return ranges
}
