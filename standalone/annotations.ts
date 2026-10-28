import { noteColors, parseNoteFile, mergeNotes, maxNoteFileLength, type NoteFile, type ReadingNote, type QuoteAnchor, type NoteColor, type NoteStyle } from './annotation-model'
import { selectionAnchor, noteForSelection, paintNotes } from './annotation-anchors'
import { annotationMessages, element, button, iconButton, colorDots, penButtons, icon } from './annotation-ui'
import { createNoteContext } from './annotation-layout'
import { formatNote } from './annotation-format'
import { noteMarkdown } from './annotation-format-model'
import './annotations.css'

type Origin = 'context' | 'panel'
type History = { before: ReadingNote[]; changed: Set<string>; group?: string }

export function mountAnnotations(scope: ParentNode) {
  const article = scope.querySelector<HTMLElement>('article.vp-doc')
  if (!article || document.querySelector('[data-course-annotations-ui]')) return
  const lang = document.documentElement.lang
  const ui = annotationMessages[/^zh(?:-|$)/i.test(lang) ? 'zh' : 'en']
  const bookId = document.querySelector<HTMLMetaElement>('meta[name="course-topic"]')?.content || document.title
  const storageKey = `course-annotations:v1:${bookId}`
  let records: ReadingNote[] = [], storageFailed = false
  const readStored = () => { const raw = localStorage.getItem(storageKey); return raw ? parseNoteFile(raw, bookId).records : [] }
  try { records = readStored() } catch { storageFailed = true }
  let preferredPen: NoteStyle = 'highlight'
  const penColors: Record<NoteStyle, NoteColor> = { highlight: 'yellow', underline: 'yellow' }
  try {
    const pref = JSON.parse(localStorage.getItem(`${storageKey}:pens`) || 'null')
    if (pref?.pen === 'highlight' || pref?.pen === 'underline') preferredPen = pref.pen
    for (const style of ['highlight', 'underline'] as const) if (noteColors.includes(pref?.[style])) penColors[style] = pref[style]
  } catch { /* Preferences do not replace the note store. */ }
  const history: History[] = [], expanded = new Set<string>()
  let ranges = new Map<string, Range>(), pending: QuoteAnchor | null = null
  let editing: { id: string; origin: Origin; group: string } | null = null
  let editor: HTMLElement | null = null, draftTimer = 0, toastTimer = 0, filter = 'all'
  let focusAfterClose: HTMLElement | null = null
  const payload = (): NoteFile => ({ schema: 'course-annotations/v1', bookId, records })
  const root = element('div', '', 'course-notes-ui'); root.dataset.courseAnnotationsUi = ''
  const toggle = iconButton(ui.notes, 'note', () => panel.open ? closePanel() : openPanel(), ui.toggle)
  toggle.className = 'course-notes-toggle'; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'course-reading-notes')
  const panel = element('dialog', '', 'course-notes-panel'); panel.id = 'course-reading-notes'; panel.setAttribute('aria-label', ui.notes)
  const header = element('div', '', 'course-notes-header'), heading = element('h2', ui.annotations)
  const statusDot = element('span', '', 'course-notes-status-dot'); statusDot.setAttribute('role', 'status')
  const searchToggle = iconButton(ui.searchToggle, 'search', () => { searchRow.hidden = !searchRow.hidden; if (!searchRow.hidden) search.focus() })
  const menu = element('details', '', 'course-notes-menu'), summary = element('summary')
  summary.setAttribute('aria-label', ui.more); summary.title = ui.more; summary.append(icon('more'))
  const menuBody = element('div', '', 'course-notes-menu-body'); menu.append(summary, menuBody)
  header.append(heading, statusDot, searchToggle, menu, iconButton(ui.close, 'close', closePanel))
  const storageHint = element('p', '', 'course-notes-storage'); storageHint.hidden = true; storageHint.setAttribute('role', 'status')
  const help = element('p', ui.help, 'course-notes-help')
  const toast = element('div', '', 'course-notes-toast'); toast.hidden = true; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite')
  const undo = button(ui.undo, undoLast), file = element('input')
  file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true; file.setAttribute('aria-label', ui.import)
  const download = (text: string, extension: string, type: string) => {
    try {
      const url = URL.createObjectURL(new Blob([text], { type })), link = element('a')
      link.href = url; link.download = `${bookId.replace(/[^a-z0-9_-]/gi, '-').slice(0, 100) || 'textbook'}-notes.${extension}`
      root.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch { announce(ui.exportError, true) }
  }
  const escapeMarkdown = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  menuBody.append(
    button(ui.markdown, () => {
      flushEditor()
      const lines = [`# ${escapeMarkdown(document.title)} — ${ui.notes}`, '']
      for (const row of orderedNotes()) lines.push(`## ${ui[row.style]} · ${ui.colors[noteColors.indexOf(row.color)]}`, '', ...escapeMarkdown(row.anchor.exact).split('\n').map(line => '> ' + line), '', noteMarkdown(row.note), '')
      download(lines.join('\n'), 'md', 'text/markdown;charset=utf-8')
    }),
    button(ui.json, () => { flushEditor(); download(JSON.stringify(payload(), null, 2), 'json', 'application/json') }),
    button(ui.import, () => { flushEditor(); file.click() }), undo, help, file,
  )
  file.addEventListener('change', async () => {
    const selected = file.files?.[0]
    if (!selected) return
    try {
      if (selected.size > maxNoteFileLength) throw new Error('File too large')
      const imported = parseNoteFile(await selected.text(), bookId)
      if (change(mergeNotes(records, imported.records))) announce(storageFailed ? ui.memory : ui.imported, storageFailed)
    } catch { announce(ui.invalid, true) }
    file.value = ''
  })
  const filters = element('div', '', 'course-notes-filters')
  for (const [key, label] of [['all', ui.all], ['mine', ui.mine], ['marks', ui.marks]]) {
    const chip = button(label, () => {
      finishEditing(); filter = key
      for (const other of Array.from(filters.querySelectorAll('button'))) other.setAttribute('aria-pressed', String(other === chip))
      renderList()
    })
    chip.setAttribute('aria-pressed', String(key === filter)); filters.append(chip)
  }
  const colorFilter = element('select'); colorFilter.setAttribute('aria-label', ui.color)
  colorFilter.append(new Option(ui.allColors, ''), ...noteColors.map((color, i) => new Option(ui.colors[i], color)))
  colorFilter.addEventListener('change', () => { finishEditing(); renderList() }); filters.append(colorFilter)
  const searchRow = element('div', '', 'course-notes-search'); searchRow.hidden = true
  const search = element('input'); search.type = 'search'; search.placeholder = ui.search; search.setAttribute('aria-label', ui.search)
  search.addEventListener('input', renderList); searchRow.append(search)
  const list = element('div', '', 'course-notes-list'); list.setAttribute('role', 'list')
  const empty = element('p', ui.empty, 'course-notes-empty'); panel.append(header, storageHint, filters, searchRow, empty, list)
  const toolbar = element('div', '', 'course-selection-toolbar'); toolbar.hidden = true
  toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', ui.selection)
  const popover = element('div', '', 'course-mark-popover'); popover.hidden = true
  popover.setAttribute('role', 'dialog'); popover.setAttribute('aria-label', ui.markMenu)
  root.append(toggle, panel, toolbar, popover, toast); document.body.append(root)
  const context = createNoteContext(article, root, ui)

  function nextTime() { return records.reduce((latest, row) => Math.max(latest, row.updatedAt), Date.now()) + 1 }
  function newId() { return globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}-${Math.random().toString(36).slice(2)}` }
  function rememberPen(style: NoteStyle, color: NoteColor) {
    preferredPen = style; penColors[style] = color
    try { localStorage.setItem(`${storageKey}:pens`, JSON.stringify({ pen: style, ...penColors })) } catch { /* Notes report storage failures independently. */ }
    renderToolbar()
  }
  function announce(text: string, persistent = false, canUndo = false) {
    clearTimeout(toastTimer); toast.replaceChildren(element('span', text))
    if (canUndo && history.length) toast.append(button(ui.undoShort, undoLast))
    toast.hidden = false
    if (!persistent) toastTimer = window.setTimeout(() => { toast.hidden = true }, 3000)
  }
  function persist(next: ReadingNote[]) {
    let combined = next
    try { combined = mergeNotes(next, readStored()); localStorage.setItem(storageKey, JSON.stringify({ ...payload(), records: combined })); storageFailed = false }
    catch { storageFailed = true; announce(ui.memory, true) }
    records = combined; refresh()
  }
  function change(next: ReadingNote[], group?: string): boolean {
    try { parseNoteFile(JSON.stringify({ ...payload(), records: next }), bookId) }
    catch { announce(ui.limit, true); return false }
    const before = new Map(records.map(row => [row.id, row]))
    const changed = next.filter(row => JSON.stringify(row) !== JSON.stringify(before.get(row.id))).map(row => row.id), previous = history[history.length - 1]
    if (group && previous?.group === group) for (const id of changed) previous.changed.add(id)
    else history.push({ before: records, changed: new Set(changed), group })
    if (history.length > 20) history.shift()
    persist(next); return true
  }
  function commitRecord(row: ReadingNote, group?: string): boolean {
    try { return change(mergeNotes(records, [row]), group) }
    catch { announce(ui.limit, true); return false }
  }
  function undoLast() {
    finishEditing()
    const previous = history.pop()
    if (!previous) return
    const target = new Map(previous.before.map(row => [row.id, row])), stamp = nextTime()
    persist(records.map(row => previous.changed.has(row.id) ? { ...(target.get(row.id) ?? row), deleted: target.has(row.id) ? target.get(row.id)!.deleted : true, updatedAt: stamp } : row))
    announce(storageFailed ? ui.memory : ui.undone, storageFailed)
  }
  function orderedNotes() {
    return records.filter(row => !row.deleted).sort((a, b) => {
      const left = ranges.get(a.id), right = ranges.get(b.id)
      if (left && right) return left.compareBoundaryPoints(Range.START_TO_START, right) || a.createdAt - b.createdAt
      return left ? -1 : right ? 1 : a.anchor.start - b.anchor.start
    })
  }
  function refresh(force = false) {
    ranges = paintNotes(article!, records)
    context.updateRanges(ranges)
    const count = records.filter(row => !row.deleted).length
    toggle.querySelector('span')!.textContent = `${ui.toggle} (${count})`; heading.textContent = `${ui.annotations} ${count}`; undo.disabled = !history.length
    statusDot.title = storageFailed ? ui.memory : ui.saved; statusDot.setAttribute('aria-label', statusDot.title); statusDot.classList.toggle('is-warning', storageFailed)
    storageHint.hidden = !storageFailed; storageHint.textContent = storageFailed ? ui.memory : ''
    const hint = editor?.querySelector<HTMLElement>('.course-editor-hint'); if (hint) hint.textContent = storageFailed ? ui.memory : ui.auto
    const typing = !!editor?.contains(document.activeElement)
    if (force || !typing || editing?.origin !== 'panel') renderList()
    if (force || !typing || editing?.origin !== 'context') renderContext(); else context.layout()
  }
  function cardShell(row: ReadingNote, origin: Origin) {
    const card = element('div', '', 'course-note-card'); card.dataset.noteId = row.id; card.dataset.color = row.color
    card.setAttribute('role', origin === 'panel' ? 'listitem' : 'note')
    const label = element('div', '', 'course-note-label'); label.append(element('span', row.note || editing?.id === row.id ? ui.myNote : ui.onlyHighlight))
    const date = new Date(row.updatedAt)
    if (Number.isFinite(date.getTime())) {
      const time = element('time', date.toLocaleDateString(lang || 'en', { month: 'short', day: 'numeric' }))
      time.dateTime = date.toISOString(); time.title = date.toLocaleString(lang || 'en'); label.append(time)
    }
    const quote = button(`「${row.anchor.exact}」`, () => jumpTo(row.id)); quote.className = 'course-note-quote'; quote.title = row.anchor.exact
    quote.setAttribute('aria-label', `${ui.jump}: ${row.anchor.exact}`); quote.disabled = !ranges.has(row.id); card.append(label, quote)
    if (!ranges.has(row.id)) card.append(element('p', ui.missing, 'course-note-orphan'))
    return card
  }
  function createCard(row: ReadingNote, origin: Origin): HTMLElement {
    if (editing?.id === row.id && editing.origin === origin && editor) return editor
    const card = cardShell(row, origin); card.append(formatNote(row.note))
    if (row.note.length > 500 || row.note.split('\n').length > 6) {
      card.classList.toggle('is-expanded', expanded.has(row.id))
      const more = button(expanded.has(row.id) ? ui.collapse : ui.expand, () => {
        if (expanded.has(row.id)) expanded.delete(row.id); else expanded.add(row.id)
        card.classList.toggle('is-expanded', expanded.has(row.id)); more.textContent = expanded.has(row.id) ? ui.collapse : ui.expand; context.layout()
      }); more.className = 'course-note-expand'; card.append(more)
    }
    const actions = element('div', '', 'course-note-actions'); actions.append(button(ui.edit, () => openEditor(row, origin)), button(ui.remove, () => removeNote(row))); card.append(actions)
    if (origin === 'panel') {
      card.tabIndex = 0
      card.addEventListener('click', event => { if (!(event.target as Element).closest('button,textarea,input,select,a') && getSelection()?.isCollapsed) jumpTo(row.id) })
      card.addEventListener('keydown', event => { if (event.target === card && ['Enter', ' '].includes(event.key)) { event.preventDefault(); jumpTo(row.id) } })
    }
    return card
  }
  function sectionFor(row: ReadingNote) {
    const range = ranges.get(row.id); let title = ''
    if (range) for (const heading of Array.from(article!.querySelectorAll('h2[id],h3[id]'))) {
      if (heading.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING) title = heading.textContent?.replace(/\u200b/g, '').trim() ?? ''
    }
    return title
  }
  function renderList() {
    if (editing?.origin === 'panel' && editor?.contains(document.activeElement)) return
    const live = orderedNotes(), query = search.value.trim().toLocaleLowerCase()
    const matches = live.filter(row => (filter !== 'mine' || !!row.note.trim()) && (filter !== 'marks' || !row.note.trim()) && (!colorFilter.value || colorFilter.value === row.color) && (!query || `${row.anchor.exact}\n${row.note}`.toLocaleLowerCase().includes(query)))
    empty.hidden = !!matches.length; empty.textContent = live.length ? ui.noMatches : ui.empty; list.replaceChildren(); let section = ''
    for (const row of matches) { const next = sectionFor(row); if (next && next !== section) list.append(element('div', next, 'course-notes-section')); section = next; list.append(createCard(row, 'panel')) }
  }
  function renderContext() {
    const items = orderedNotes().filter(row => ranges.has(row.id) && (row.note.trim() || editing?.id === row.id)).map(row => ({ id: row.id, range: ranges.get(row.id)!, card: createCard(row, 'context') }))
    context.render(items, panel.open, editing?.origin === 'context' ? editing.id : undefined)
  }
  function updateEditorColor() {
    const row = records.find(row => row.id === editing?.id); if (!row || !editor) return
    editor.dataset.color = row.color
    for (const node of Array.from(editor.querySelectorAll<HTMLElement>('[data-color]'))) node.setAttribute('aria-pressed', String(node.dataset.color === row.color))
    for (const node of Array.from(editor.querySelectorAll<HTMLElement>('[data-style]'))) node.setAttribute('aria-pressed', String(node.dataset.style === row.style))
  }
  function createEditor(row: ReadingNote, origin: Origin) {
    const card = cardShell(row, origin); card.classList.add('course-notes-editor'); card.setAttribute('aria-label', ui.editor)
    const textarea = element('textarea'); textarea.value = row.note; textarea.rows = 3; textarea.maxLength = 12000; textarea.placeholder = ui.placeholder; textarea.setAttribute('aria-label', ui.text)
    const controls = element('div', '', 'course-editor-controls')
    const patch = (change: Partial<ReadingNote>) => {
      flushEditor(); const current = records.find(item => item.id === row.id)
      if (current) commitRecord({ ...current, ...change, updatedAt: nextTime() }, editing?.group)
      updateEditorColor()
    }
    controls.append(penButtons(ui, row.style, style => patch({ style })), colorDots(ui, row.color, color => patch({ color })), iconButton(ui.done, 'done', finishEditing))
    const preview = element('div', '', 'course-note-preview'); preview.setAttribute('aria-label', ui.preview)
    const showPreview = () => {
      const rendered = formatNote(textarea.value)
      preview.hidden = !rendered.querySelector('strong,code,.course-note-math')
      preview.replaceChildren(rendered); context.layout()
    }
    let previewTimer = 0
    card.append(textarea, preview, controls, element('p', ui.format, 'course-editor-format'), element('p', storageFailed ? ui.memory : ui.auto, 'course-editor-hint'))
    showPreview()
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto'; textarea.style.height = `${Math.min(480, Math.max(86, textarea.scrollHeight))}px`
      clearTimeout(draftTimer); draftTimer = window.setTimeout(flushEditor, 450); context.layout()
      clearTimeout(previewTimer); previewTimer = window.setTimeout(() => { if (card.isConnected) showPreview() }, 250)
    })
    card.addEventListener('focusout', () => { window.setTimeout(() => { if (editing?.id === row.id && editor === card && !card.contains(document.activeElement)) finishEditing() }, 120) })
    return card
  }
  function flushEditor() {
    clearTimeout(draftTimer)
    const row = records.find(item => item.id === editing?.id), textarea = editor?.querySelector('textarea')
    if (row && textarea && textarea.value !== row.note) commitRecord({ ...row, note: textarea.value, deleted: false, updatedAt: nextTime() }, editing?.group)
  }
  function finishEditing() { if (editing) { flushEditor(); editing = null; editor = null; refresh(true) } }
  function openEditor(target: ReadingNote | QuoteAnchor, origin: Origin = panel.open ? 'panel' : 'context') {
    finishEditing(); popover.hidden = true; toolbar.hidden = true
    const stamp = nextTime()
    const row: ReadingNote = 'id' in target ? records.find(item => item.id === target.id) ?? target : noteForSelection(article!, target, records) ?? { id: newId(), anchor: target, color: penColors[preferredPen], style: preferredPen, note: '', createdAt: stamp, updatedAt: stamp, deleted: false }
    editing = { id: row.id, origin, group: `edit-${row.id}-${stamp}` }; editor = createEditor(row, origin); getSelection()?.removeAllRanges()
    if (!records.some(item => item.id === row.id)) commitRecord(row, editing.group); else refresh(true)
    const textarea = editor?.querySelector('textarea'); textarea?.focus({ preventScroll: true })
    if (textarea) { textarea.style.height = `${Math.min(480, Math.max(86, textarea.scrollHeight))}px`; context.layout(); const rect = textarea.getBoundingClientRect(); if (rect.bottom > innerHeight - 32 || rect.top < 64) textarea.scrollIntoView({ block: 'nearest' }) }
  }
  function removeNote(row: ReadingNote) {
    if (editing?.id === row.id) finishEditing()
    if (commitRecord({ ...row, deleted: true, updatedAt: nextTime() })) announce(storageFailed ? ui.memory : ui.deleted, storageFailed, true)
    popover.hidden = true
  }
  function openPanel() {
    finishEditing(); toolbar.hidden = true; popover.hidden = true
    if (!panel.open) { if (matchMedia('(max-width: 800px)').matches) panel.showModal(); else panel.show(); document.documentElement.classList.add('course-notes-open'); toggle.setAttribute('aria-expanded', 'true'); refresh(true) }
  }
  function closePanel() { finishEditing(); panel.close() }
  panel.addEventListener('close', () => {
    finishEditing(); document.documentElement.classList.remove('course-notes-open'); toggle.setAttribute('aria-expanded', 'false')
    const target = focusAfterClose ?? toggle; target.focus({ preventScroll: true }); focusAfterClose = null; refresh(true)
  })
  function jumpTo(id: string) {
    flushEditor(); const target = ranges.get(id)?.startContainer.parentElement; if (!target) return
    if (panel.open && matchMedia('(max-width: 800px)').matches) { focusAfterClose = target; closePanel() }
    let container = target.closest('details'); while (container) { container.open = true; container = container.parentElement?.closest('details') ?? null }
    target.scrollIntoView({ block: 'center' }); target.tabIndex = -1; target.focus({ preventScroll: true })
  }
  function position(node: HTMLElement, rect: DOMRect | { left: number; right: number; top: number; bottom: number }) {
    node.style.left = `${Math.max(8, Math.min((rect.left + rect.right) / 2 - node.offsetWidth / 2, innerWidth - node.offsetWidth - 8))}px`
    const above = rect.top - node.offsetHeight - 8; node.style.top = `${Math.max(8, Math.min(above >= 8 ? above : rect.bottom + 8, innerHeight - node.offsetHeight - 8))}px`
  }
  function showMarkMenu(row: ReadingNote, x: number, y: number) {
    finishEditing(); toolbar.hidden = true
    const controls = element('div', '', 'course-mark-tools')
    const patch = (next: Partial<ReadingNote>) => {
      const current = records.find(item => item.id === row.id) ?? row
      rememberPen(next.style ?? current.style, next.color ?? current.color)
      commitRecord({ ...current, ...next, updatedAt: nextTime() }); popover.hidden = true
    }
    controls.append(penButtons(ui, row.style, style => patch({ style })), colorDots(ui, row.color, color => patch({ color })))
    const actions = element('div', '', 'course-note-actions'); actions.append(button(ui.write, () => openEditor(row)), button(ui.remove, () => removeNote(row)))
    popover.replaceChildren(controls, actions); popover.hidden = false; position(popover, { left: x, right: x, top: y - 6, bottom: y + 6 })
  }
  function addMark(style: NoteStyle, color = penColors[style]) {
    if (!pending) return
    const anchor = pending
    finishEditing()
    const previous = noteForSelection(article!, anchor, records), stamp = nextTime()
    rememberPen(style, color)
    const changed = !previous || previous.color !== color || previous.style !== style || JSON.stringify(previous.anchor) !== JSON.stringify(anchor)
    if (changed) {
      const row: ReadingNote = previous ? { ...previous, anchor, color, style, updatedAt: stamp } : { id: newId(), anchor, color, style, note: '', createdAt: stamp, updatedAt: stamp, deleted: false }
      if (!commitRecord(row)) return
    }
    toolbar.hidden = true; getSelection()?.removeAllRanges()
    if (changed) announce(storageFailed ? ui.memory : previous ? ui.updated : ui.added, storageFailed, true)
  }
  function renderToolbar() {
    const previous = pending ? noteForSelection(article!, pending, records) : undefined
    const style = previous?.style ?? preferredPen
    toolbar.replaceChildren(penButtons(ui, style, next => addMark(next)), colorDots(ui, previous?.color ?? penColors[style], color => addMark(style, color)),
      iconButton(ui.add, 'note', () => { if (pending) openEditor(pending) }, ui.add), iconButton(ui.copy, 'copy', async () => {
        if (!pending) return
        try { await navigator.clipboard.writeText(pending.exact); toolbar.hidden = true; getSelection()?.removeAllRanges(); announce(ui.copied) } catch { announce(ui.copyFailed, true) }
      }))
  }
  function selectionChanged() {
    if (document.activeElement?.closest('button.copy')) { toolbar.hidden = true; pending = null; return }
    if (root.contains(document.activeElement)) return
    const selection = getSelection(), range = selection?.rangeCount ? selection.getRangeAt(0) : null
    pending = range ? selectionAnchor(article!, range) : null; toolbar.hidden = !pending
    if (pending && range) { renderToolbar(); popover.hidden = true; position(toolbar, range.getBoundingClientRect()) }
  }
  toolbar.addEventListener('mousedown', event => event.preventDefault()); document.addEventListener('selectionchange', selectionChanged)
  article.addEventListener('pointerup', event => {
    selectionChanged()
    if (!getSelection()?.isCollapsed || (event.target as Element).closest('a,button,input,select,textarea')) return
    for (const row of records.filter(row => !row.deleted).sort((a, b) => Number(!!b.note) - Number(!!a.note) || b.updatedAt - a.updatedAt)) {
      const range = ranges.get(row.id)
      if (range && Array.from(range.getClientRects()).some(rect => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)) { if (row.note) openEditor(row); else showMarkMenu(row, event.clientX, event.clientY); break }
    }
  })
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target as Node)) { popover.hidden = true; menu.open = false } })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      toolbar.hidden = true
      if (!popover.hidden) { popover.hidden = true; event.preventDefault() }
      else if (editing) { finishEditing(); event.preventDefault() }
      else if (panel.open) { closePanel(); event.preventDefault() }
      return
    }
    if (editor?.contains(event.target as Node) && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); finishEditing(); return }
    if ((event.target as Element).closest('input,textarea,select,[contenteditable]')) return
    if (event.ctrlKey && event.altKey && ['h', 'n'].includes(event.key.toLowerCase())) {
      selectionChanged(); if (!pending) return
      event.preventDefault(); if (event.key.toLowerCase() === 'h') addMark('highlight'); else openEditor(pending)
    } else if (pending && !toolbar.hidden && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const digit = Number(event.key)
      if (digit >= 1 && digit <= 4) { event.preventDefault(); addMark(noteForSelection(article!, pending, records)?.style ?? preferredPen, noteColors[digit - 1]) }
      else if (event.key.toLowerCase() === 'n') { event.preventDefault(); openEditor(pending) }
    }
  })
  window.addEventListener('pagehide', flushEditor)
  window.addEventListener('storage', event => {
    if (event.key !== storageKey || !event.newValue) return
    try { records = mergeNotes(records, parseNoteFile(event.newValue, bookId).records); refresh() }
    catch { storageFailed = true; storageHint.hidden = false; storageHint.textContent = ui.memory }
  })
  renderToolbar(); refresh()
}
