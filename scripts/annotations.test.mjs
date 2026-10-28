import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../standalone/annotation-model.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { quoteAnchor, locateQuote, parseNoteFile, mergeNotes, maxActiveNotes, maxNoteFileLength } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
const formatSource = await readFile(new URL('../standalone/annotation-format-model.ts', import.meta.url), 'utf8')
const formatCompiled = ts.transpileModule(formatSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { tokenizeNote, noteMarkdown } = await import('data:text/javascript;base64,' + Buffer.from(formatCompiled).toString('base64'))
const record = (overrides = {}) => ({ id: 'note-1', anchor: quoteAnchor('Before 精确原文 after.', 7, 11), color: 'teal', style: 'highlight', note: 'A useful note.', createdAt: 1, updatedAt: 2, deleted: false, ...overrides })
const file = records => JSON.stringify({ schema: 'course-annotations/v1', bookId: 'test-book', records })

test('note formatting separates bold, TeX, code, escapes, and incomplete delimiters', () => {
  assert.deepEqual(tokenizeNote('理解 **重要 $x_i^2$**。'), [
    { type: 'text', value: '理解 ' },
    { type: 'strong', children: [{ type: 'text', value: '重要 ' }, { type: 'math', value: 'x_i^2', display: false, source: '$x_i^2$' }] },
    { type: 'text', value: '。' },
  ])
  const formula = String.raw`\frac{a_b}{\sqrt{c}}+x**2`
  assert.deepEqual(tokenizeNote(`$$${formula}$$`), [{ type: 'math', value: formula, display: true, source: `$$${formula}$$` }])
  assert.deepEqual(tokenizeNote('`**literal** $x$`'), [{ type: 'code', value: '**literal** $x$' }])
  assert.deepEqual(tokenizeNote(String.raw`\*\*literal\*\* \$x\$`), [{ type: 'text', value: '**literal** $x$' }])
  for (const source of ['**unfinished', '$unfinished', '$$', '$5 and $10', '$ x $', '<img src=x>']) {
    assert.ok(tokenizeNote(source).every(token => token.type === 'text'))
    assert.equal(tokenizeNote(source).map(token => token.value).join(''), source)
  }
  const exported = String.raw`**重要** $x<y$，$$\begin{matrix}a&b\\c&d\end{matrix}$$，` + '`<b>&</b>`'
  assert.equal(noteMarkdown(exported + '\n<img src=x>'), exported + '\n&lt;img src=x&gt;')
  assert.equal(noteMarkdown(String.raw`\$not math <b>\$`), String.raw`\$not math &lt;b&gt;\$`)
})

test('quote anchors survive inserted text and refuse missing or ambiguous matches', () => {
  const text = 'First context: repeated phrase. Second context: repeated phrase. End.'
  const start = text.lastIndexOf('repeated phrase')
  const anchor = quoteAnchor(text, start, start + 'repeated phrase'.length)
  assert.deepEqual(locateQuote(text, anchor), { start, end: anchor.end })
  const revised = 'New introduction. ' + text
  assert.deepEqual(locateQuote(revised, anchor), { start: start + 18, end: anchor.end + 18 })
  assert.equal(locateQuote('Nothing remains.', anchor), null)
  assert.equal(locateQuote('x repeated phrase x repeated phrase x', { ...anchor, prefix: '', suffix: '' }), null)
  assert.equal(locateQuote('one unique quote anywhere', { start: 99, end: 111, exact: 'unique quote', prefix: '', suffix: '' }).start, 4)
  assert.deepEqual(quoteAnchor('  中文 😀  ', 0, 9), { start: 2, end: 7, exact: '中文 😀', prefix: '  ', suffix: '  ' })
  assert.equal(quoteAnchor('abc', 0, 0), null)
  assert.equal(quoteAnchor('abc', -1, 3), null)
})

test('annotation imports validate identity and every record without interpreting note markup', () => {
  const note = record({ note: '<img src="https://invalid.example/track"> & plain text' })
  assert.equal(parseNoteFile(file([note]), 'test-book').records[0].note, note.note)
  assert.deepEqual(parseNoteFile(file([]), 'test-book').records, [])
  assert.throws(() => parseNoteFile(file([note]), 'another-book'))
  assert.throws(() => parseNoteFile('{', 'test-book'))
  for (const invalid of [
    { ...note, color: 'unknown' }, { ...note, style: 'script' }, { ...note, updatedAt: 0 },
    { ...note, deleted: 'yes' }, { ...note, note: null }, { ...note, anchor: null },
    { ...note, anchor: { ...note.anchor, end: note.anchor.end + 1 } },
    { ...note, anchor: { ...note.anchor, start: -1 } },
  ]) assert.throws(() => parseNoteFile(file([invalid]), 'test-book'))
  assert.throws(() => parseNoteFile(file([note, note]), 'test-book'))
})

test('merging preserves concurrent additions and deletion tombstones while newer edits can restore notes', () => {
  const old = record(), other = record({ id: 'note-2' })
  const edited = record({ note: 'Edited', updatedAt: 3 })
  const removed = record({ deleted: true, updatedAt: 4 })
  assert.equal(mergeNotes([old], [edited, other]).length, 2)
  assert.equal(mergeNotes([edited], [old])[0].note, 'Edited')
  assert.equal(mergeNotes([removed], [old])[0].deleted, true)
  assert.equal(mergeNotes([old], [removed])[0].deleted, true)
  const restored = record({ updatedAt: 5 })
  assert.equal(mergeNotes([removed], [restored])[0].deleted, false)
  assert.deepEqual(mergeNotes([edited, other], [old]), mergeNotes([old], [edited, other]))
  assert.equal(old.note, 'A useful note.', 'Merging must not mutate existing records')
})

test('deleted annotations release capacity while tombstones still prevent stale backup resurrection', () => {
  assert.throws(() => parseNoteFile(' '.repeat(maxNoteFileLength + 1), 'test-book'), /too large/)
  const deleted = Array.from({ length: maxActiveNotes + 1 }, (_, i) => record({ id: `deleted-${i}`, deleted: true, updatedAt: 4 }))
  const next = record({ id: 'new-note' })
  const restored = parseNoteFile(file(mergeNotes(deleted, [next])), 'test-book').records
  assert.equal(restored.length, deleted.length + 1)
  assert.equal(restored.filter(row => !row.deleted).length, 1)
  assert.equal(mergeNotes(restored, [record({ id: 'deleted-0' })]).find(row => row.id === 'deleted-0').deleted, true)

  const full = Array.from({ length: maxActiveNotes }, (_, i) => record({ id: `active-${i}` }))
  assert.equal(parseNoteFile(file(full), 'test-book').records.length, maxActiveNotes)
  assert.throws(() => parseNoteFile(file([...full, next]), 'test-book'), /Too many active/)
  assert.throws(() => mergeNotes(full, [next]), /Too many active/)
  const removed = { ...full[0], deleted: true, updatedAt: 4 }
  const afterDeletion = mergeNotes(full, [removed])
  const replacement = mergeNotes(afterDeletion, [next])
  assert.equal(parseNoteFile(file(replacement), 'test-book').records.filter(row => !row.deleted).length, maxActiveNotes)
  assert.throws(() => mergeNotes(replacement, [{ ...full[0], updatedAt: 5 }]), /Too many active/)
  assert.equal(full[0].deleted, false, 'Capacity checks and deletion merges must not mutate their inputs')
})
