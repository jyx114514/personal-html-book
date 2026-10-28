import { element, iconButton, type AnnotationUi } from './annotation-ui'

export type ContextNote = { id: string; range: Range; card: HTMLElement }
export function createNoteContext(article: HTMLElement, root: HTMLElement, ui: AnnotationUi) {
  const layer = element('div', '', 'course-note-context')
  const spacing = element('style')
  root.append(layer, spacing)
  let items: ContextNote[] = []
  let suppressed = false
  let frame = 0
  const collapsed = new Set<string>()
  const groups: { host: HTMLElement; wrap: HTMLElement; content: HTMLElement; key: string }[] = []
  function hostFor(range: Range) {
    const parent = range.startContainer.parentElement!
    return (parent.closest('.course-table-scroll, .table-wrap') ?? parent.closest('p,li,pre,blockquote,h1,h2,h3,h4,h5,h6') ?? parent) as HTMLElement
  }
  function selector(host: HTMLElement) {
    const parts: string[] = []
    for (let node: Element | null = host; node && node !== article; node = node.parentElement) {
      const parent: Element | null = node.parentElement
      if (!parent) break
      parts.unshift(`:nth-child(${Array.from(parent.children).indexOf(node) + 1})`)
    }
    return parts.length ? 'article.vp-doc > ' + parts.join(' > ') : 'article.vp-doc'
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(layout) }
  function layout() {
    frame = 0
    spacing.textContent = ''
    if (suppressed) return
    const rules: string[] = []
    for (const group of groups) {
      const visible = group.host.getClientRects().length > 0
      group.wrap.hidden = !visible
      if (!visible) continue
      const rect = group.host.getBoundingClientRect()
      group.wrap.style.width = `${Math.min(rect.width, innerWidth - 32)}px`
      const margin = parseFloat(getComputedStyle(group.host).marginBottom) || 0
      rules.push(`${group.key}{margin-bottom:${Math.max(margin, group.content.hidden ? 24 : group.content.offsetHeight + 44)}px!important}`)
    }
    spacing.textContent = rules.join('\n')
    for (const group of groups) {
      const rect = group.host.getBoundingClientRect()
      group.wrap.style.left = `${Math.max(16, Math.min(rect.left, innerWidth - group.wrap.offsetWidth - 16)) + scrollX}px`
      group.wrap.style.top = `${rect.bottom + scrollY + 8}px`
    }
  }
  function render(next: ContextNote[], hidden: boolean, editor?: string) {
    items = next
    suppressed = hidden
    layer.hidden = suppressed
    spacing.textContent = ''
    layer.replaceChildren()
    groups.length = 0
    if (suppressed) return
    for (const item of items) {
      item.card.hidden = false
      for (const property of ['left', 'top', 'width']) item.card.style.removeProperty(property)
    }
    const grouped = new Map<HTMLElement, ContextNote[]>()
    for (const item of items) {
      const host = hostFor(item.range)
      grouped.set(host, [...(grouped.get(host) ?? []), item])
    }
    for (const [host, notes] of grouped) {
      const key = selector(host)
      if (notes.some(item => item.id === editor)) collapsed.delete(key)
      const wrap = element('div', '', 'course-context-group')
      const content = element('div', '', 'course-inline-notes')
      content.hidden = collapsed.has(key)
      const pin = iconButton(`${ui.pin} (${notes.length})`, 'note', () => {
        if (collapsed.has(key)) collapsed.delete(key)
        else collapsed.add(key)
        content.hidden = collapsed.has(key)
        pin.setAttribute('aria-expanded', String(!content.hidden))
        schedule()
      }, String(notes.length))
      pin.className = 'course-note-pin'
      pin.setAttribute('aria-expanded', String(!content.hidden))
      content.append(...notes.map(item => item.card))
      wrap.append(pin, content)
      layer.append(wrap)
      groups.push({ host, wrap, content, key })
    }
    layout()
  }
  window.addEventListener('resize', schedule)
  new ResizeObserver(schedule).observe(article)
  document.addEventListener('toggle', schedule, true)
  document.fonts.ready.then(schedule)
  return { render, layout: schedule, updateRanges(ranges: Map<string, Range>) { for (const item of items) item.range = ranges.get(item.id) ?? item.range } }
}
