export const outlineExcludedClasses = ['course-outline-source', 'omics-lab', 'computer-lab', 'demo', 'explorer']
export const outlineExcludedSelector = '[data-course-component], [data-course-outline="exclude"], ' + outlineExcludedClasses.map(name => '.' + name).join(', ')
const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))

/** @typedef {{ href: string, title: string, level: number, children: OutlineNode[] }} OutlineNode */
/** @param {{ href: string, title: string, level: number }[]} items */
export function buildOutlineTree(items) {
  /** @type {OutlineNode[]} */
  const roots = []
  /** @type {OutlineNode[]} */
  const stack = []
  for (const item of items) {
    const node = { ...item, children: [] }
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop()
    if (stack.length) stack[stack.length - 1].children.push(node)
    else roots.push(node)
    stack.push(node)
  }
  return roots
}

/** @param {OutlineNode[]} tree */
export function renderOutlineTree(tree) {
  return tree.map(item => {
    const link = `<a href="${escape(item.href)}">${escape(item.title)}</a>`
    return item.children.length
      ? `<li><details class="outline-branch"><summary>${link}</summary><ol>${renderOutlineTree(item.children)}</ol></details></li>`
      : `<li>${link}</li>`
  }).join('\n')
}

/** @param {Element} article @param {Element | null} source */
export function collectDomOutline(article, source = article.querySelector('.course-outline-source')) {
  const headings = Array.from(article.querySelectorAll('h2[id], h3[id], h4[id], h5[id], h6[id]')).filter(heading => !heading.closest(outlineExcludedSelector))
  const records = new Map(headings.map(heading => {
    const clone = heading.cloneNode(true)
    if (clone instanceof Element) clone.querySelectorAll('.header-anchor').forEach(anchor => anchor.remove())
    return [heading, { href: '#' + heading.id, title: clone.textContent?.replace(/\u200b/g, '').trim() ?? '', level: Number(heading.tagName.slice(1)) }]
  }))
  for (const link of Array.from(source?.querySelectorAll('a[href^="#"]:not(.header-anchor)') ?? [])) {
    const href = link.getAttribute('href') ?? ''
    let id = href.slice(1)
    try { id = decodeURIComponent(id) } catch { /* Preserve literal hash on malformed escapes. */ }
    const target = article.ownerDocument.getElementById(id)
    if (!target || !article.contains(target) || target.closest(outlineExcludedSelector)) continue
    records.set(target, { href, title: link.textContent?.trim() ?? '', level: records.get(target)?.level ?? 2 })
  }
  return [...records.entries()].sort(([a], [b]) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1).map(([, item]) => item)
}
