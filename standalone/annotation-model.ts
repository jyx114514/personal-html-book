export const noteColors = ['yellow', 'teal', 'orange', 'blue'] as const
export type NoteColor = typeof noteColors[number]
export type NoteStyle = 'highlight' | 'underline'
export type QuoteAnchor = { start: number; end: number; exact: string; prefix: string; suffix: string }
export type ReadingNote = {
  id: string; anchor: QuoteAnchor; color: NoteColor; style: NoteStyle; note: string
  createdAt: number; updatedAt: number; deleted: boolean
}
export type NoteFile = { schema: 'course-annotations/v1'; bookId: string; records: ReadingNote[] }
export const maxNoteFileLength = 40_000_000
// Deletion tombstones preserve backup/merge semantics without consuming the
// reader's active-note allowance. The serialized file still has a size limit.
export const maxActiveNotes = 2000

function assertNoteCapacity(records: ReadingNote[]) {
  if (records.filter(row => !row.deleted).length > maxActiveNotes) throw new Error('Too many active annotations')
}

export function quoteAnchor(text: string, start: number, end: number): QuoteAnchor | null {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > text.length) return null
  while (start < end && /\s/.test(text[start])) start++
  while (end > start && /\s/.test(text[end - 1])) end--
  if (start < 0 || end > text.length || end <= start || end - start > 4096) return null
  return { start, end, exact: text.slice(start, end), prefix: text.slice(Math.max(0, start - 32), start), suffix: text.slice(end, end + 32) }
}

export function locateQuote(text: string, anchor: QuoteAnchor): { start: number; end: number } | null {
  const { exact, prefix, suffix } = anchor
  if (!exact) return null
  const contextScore = (start: number) => {
    let score = 0
    for (let i = 1; i <= prefix.length && text[start - i] === prefix[prefix.length - i]; i++) score++
    for (let i = 0; i < suffix.length && text[start + exact.length + i] === suffix[i]; i++) score++
    return score
  }
  if (text.slice(anchor.start, anchor.end) === exact && contextScore(anchor.start) === prefix.length + suffix.length) return { start: anchor.start, end: anchor.end }
  let best = -1, score = -1, ambiguous = false
  for (let at = text.indexOf(exact); at >= 0; at = text.indexOf(exact, at + 1)) {
    const next = contextScore(at)
    if (next > score) { best = at; score = next; ambiguous = false }
    else if (next === score) ambiguous = true
  }
  return best < 0 || ambiguous ? null : { start: best, end: best + exact.length }
}

export function parseNoteFile(raw: string, bookId: string): NoteFile {
  if (raw.length > maxNoteFileLength) throw new Error('Annotation file is too large')
  const value = JSON.parse(raw)
  if (!value || value.schema !== 'course-annotations/v1' || value.bookId !== bookId || !Array.isArray(value.records)) throw new Error('Invalid annotation file or textbook identity')
  const ids = new Set<string>()
  const string = (input: unknown, max: number, min = 0): input is string => typeof input === 'string' && input.length >= min && input.length <= max
  const integer = (input: unknown): input is number => Number.isSafeInteger(input) && Number(input) >= 0
  const records = value.records.map((entry: unknown): ReadingNote => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid annotation')
    const row = entry as ReadingNote
    const anchor = row.anchor
    if (!string(row.id, 128, 1) || ids.has(row.id) || !noteColors.includes(row.color) || !['highlight', 'underline'].includes(row.style) ||
      !string(row.note, 12000) || typeof row.deleted !== 'boolean' || !integer(row.createdAt) || !integer(row.updatedAt) || row.updatedAt < row.createdAt ||
      !anchor || !integer(anchor.start) || !integer(anchor.end) || !string(anchor.exact, 4096, 1) || anchor.end - anchor.start !== anchor.exact.length ||
      !string(anchor.prefix, 32) || !string(anchor.suffix, 32)) throw new Error('Invalid annotation')
    ids.add(row.id)
    return { id: row.id, anchor: { start: anchor.start, end: anchor.end, exact: anchor.exact, prefix: anchor.prefix, suffix: anchor.suffix }, color: row.color, style: row.style, note: row.note, createdAt: row.createdAt, updatedAt: row.updatedAt, deleted: row.deleted }
  })
  assertNoteCapacity(records)
  return { schema: 'course-annotations/v1', bookId, records }
}

export function mergeNotes(left: ReadingNote[], right: ReadingNote[]): ReadingNote[] {
  const merged = new Map<string, ReadingNote>()
  for (const row of [...left, ...right]) {
    const previous = merged.get(row.id)
    if (!previous || row.updatedAt > previous.updatedAt || (row.updatedAt === previous.updatedAt && (row.deleted && !previous.deleted || row.deleted === previous.deleted && JSON.stringify(row) > JSON.stringify(previous)))) merged.set(row.id, row)
  }
  const records = [...merged.values()]
  assertNoteCapacity(records)
  return records.sort((a, b) => a.id.localeCompare(b.id))
}
