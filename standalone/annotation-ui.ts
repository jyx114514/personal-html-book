import { noteColors, type NoteColor, type NoteStyle } from './annotation-model'

export const annotationMessages = {
  zh: {
    notes: '阅读笔记', toggle: '笔记', annotations: '批注', close: '关闭笔记', selection: '选区批注', highlight: '高亮', underline: '下划线', add: '笔记', write: '写笔记',
    colors: ['黄色', '青绿色', '橙色', '蓝色'], color: '批注颜色', done: '完成', edit: '编辑', remove: '删除', jump: '定位原文',
    empty: '还没有批注。选中文字即可划线或写笔记。', search: '搜索原文或笔记', searchToggle: '搜索批注', allColors: '所有颜色', all: '全部', mine: '我的笔记', marks: '划线',
    noMatches: '这个分类下没有内容。', onlyHighlight: '划线', myNote: '我的笔记', missing: '原文已修改，暂时无法定位；笔记仍然保留。',
    editor: '编辑笔记', text: '笔记内容', placeholder: '写下你的理解、疑问或联想…', auto: '自动保存 · Esc 收起', format: '支持 **粗体** · $公式$ · $$独立公式$$', preview: '笔记预览',
    saved: '已保存到本浏览器', memory: '浏览器存储不可用、已满或数据损坏，当前修改仅保留在本页，请导出 JSON 备份。',
    help: '笔记保存在此浏览器。移动 HTML、清理浏览器数据或换设备前，请导出 JSON；在对应教材中导入即可恢复。',
    json: '导出 JSON', markdown: '导出 Markdown', import: '导入 JSON', imported: '笔记已合并导入。', more: '更多操作',
    invalid: '无法导入：文件格式、大小或教材标识不匹配，原有笔记保持不变。', undo: '撤销上次修改', undoShort: '撤销',
    added: '已划线，点划线可以写笔记或改颜色。', updated: '已更新原有标记，笔记内容已保留。', deleted: '批注已删除。', undone: '已撤销上次修改。', exportError: '导出失败，请重试。', limit: '无法保存：批注数量已达上限。',
    markMenu: '划线操作', pin: '段落笔记', copy: '复制选中文字', copied: '已复制', copyFailed: '请按 Ctrl+C 或 ⌘C 复制当前选中文字。', expand: '展开全文', collapse: '收起全文',
  },
  en: {
    notes: 'Reading notes', toggle: 'Notes', annotations: 'Annotations', close: 'Close notes', selection: 'Annotate selection', highlight: 'Highlight', underline: 'Underline', add: 'Note', write: 'Add note',
    colors: ['Yellow', 'Teal', 'Orange', 'Blue'], color: 'Annotation color', done: 'Done', edit: 'Edit', remove: 'Delete', jump: 'Go to quote',
    empty: 'No annotations yet. Select text to mark it or write a note.', search: 'Search quotes or notes', searchToggle: 'Search annotations', allColors: 'All colors', all: 'All', mine: 'My notes', marks: 'Highlights',
    noMatches: 'Nothing in this category.', onlyHighlight: 'Highlight', myNote: 'My note', missing: 'The text has changed and cannot be located. Your note is retained.',
    editor: 'Edit note', text: 'Note text', placeholder: 'Your understanding, questions, or connections…', auto: 'Autosaved · Esc to close', format: 'Supports **bold** · $math$ · $$display math$$', preview: 'Note preview',
    saved: 'Saved in this browser', memory: 'Browser storage is unavailable or full, or its data is damaged. Changes are only in this page; export a JSON backup.',
    help: 'Notes stay in this browser. Export JSON before moving the HTML, clearing browser data, or switching devices. Import it into the same textbook to restore notes.',
    json: 'Export JSON', markdown: 'Export Markdown', import: 'Import JSON', imported: 'Notes imported and merged.', more: 'More actions',
    invalid: 'Cannot import: invalid format, file size, or textbook identity. Existing notes were not changed.', undo: 'Undo last change', undoShort: 'Undo',
    added: 'Marked. Click the mark to add a note or change its color.', updated: 'Existing mark updated. Note text kept.', deleted: 'Annotation deleted.', undone: 'Last change undone.', exportError: 'Export failed. Please try again.', limit: 'Cannot save: annotation limit reached.',
    markMenu: 'Highlight actions', pin: 'Paragraph notes', copy: 'Copy selected text', copied: 'Copied', copyFailed: 'Press Ctrl+C or ⌘C to copy the selected text.', expand: 'Show more', collapse: 'Show less',
  },
}
export type AnnotationUi = typeof annotationMessages.zh

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag)
  node.textContent = text
  if (className) node.className = className
  return node
}
export function button(text: string, action: () => void) {
  const node = element('button', text)
  node.type = 'button'
  node.addEventListener('click', action)
  return node
}
type IconName = 'highlight' | 'underline' | 'note' | 'copy' | 'close' | 'more' | 'search' | 'done'
export function icon(name: IconName) {
  const paths: Record<IconName, string> = {
    highlight: 'm4 11 7-7 4 4-7 7H4v-4Zm5-5 4 4M3 17h7',
    underline: 'M5 3v6a4 4 0 0 0 8 0V3M3 17h12',
    note: 'M4 3h10v12H4zM7 7h4M7 10h4M7 13h2',
    copy: 'M7 6h8v10H7zM4 12H3V2h8v1',
    close: 'm4 4 10 10M14 4 4 14',
    more: 'M3 9h.1M9 9h.1M15 9h.1',
    search: 'M12 12 16 16M13 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
    done: 'm3 9 4 4 8-9',
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 18 18')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(svg.namespaceURI, 'path')
  path.setAttribute('d', paths[name])
  svg.append(path)
  return svg
}
export function iconButton(label: string, name: IconName, action: () => void, visibleText = '') {
  const node = button('', action)
  node.setAttribute('aria-label', label)
  node.title = label
  node.append(icon(name))
  if (visibleText) node.append(element('span', visibleText))
  return node
}
export function colorDots(ui: AnnotationUi, selected: NoteColor, action: (color: NoteColor) => void) {
  const group = element('div', '', 'course-note-palette')
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', ui.color)
  for (const [i, color] of noteColors.entries()) {
    const swatch = button('', () => action(color))
    swatch.dataset.color = color
    swatch.title = ui.colors[i]
    swatch.setAttribute('aria-label', ui.colors[i])
    swatch.setAttribute('aria-pressed', String(selected === color))
    group.append(swatch)
  }
  return group
}
export function penButtons(ui: AnnotationUi, selected: NoteStyle, action: (style: NoteStyle) => void) {
  const group = element('div', '', 'course-note-pens')
  for (const style of ['highlight', 'underline'] as const) {
    const node = iconButton(ui[style], style, () => action(style))
    node.dataset.style = style
    node.setAttribute('aria-pressed', String(style === selected))
    group.append(node)
  }
  return group
}
