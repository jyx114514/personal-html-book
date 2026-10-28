export type NoteToken = { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; children: NoteToken[] }
  | { type: 'math'; value: string; display: boolean; source: string }

// A small inline grammar for notes, deliberately without HTML, links or images.
// Code and TeX are opaque, so Markdown never consumes TeX's * or backslashes.
function parseNote(source: string) {
  let position = 0
  const literalRanges: { start: number; end: number }[] = []
  function parse(inStrong = false): { tokens: NoteToken[]; closed: boolean } {
    const tokens: NoteToken[] = []
    const text = (value: string) => {
      const previous = tokens[tokens.length - 1]
      if (previous?.type === 'text') previous.value += value
      else tokens.push({ type: 'text', value })
    }
    while (position < source.length) {
      const start = position, char = source[position]
      if (char === '\\' && /[\\`*$]/.test(source[position + 1] ?? '')) {
        text(source[position + 1]); position += 2; continue
      }
      if (char === '`') {
        const delimiter = source.slice(position).match(/^`+/)![0]
        let end = source.indexOf(delimiter, position + delimiter.length)
        while (end >= 0 && (source[end - 1] === '`' || source[end + delimiter.length] === '`')) end = source.indexOf(delimiter, end + delimiter.length)
        if (end >= 0) {
          tokens.push({ type: 'code', value: source.slice(position + delimiter.length, end) })
          position = end + delimiter.length
          literalRanges.push({ start, end: position }); continue
        }
        text(delimiter); position += delimiter.length; continue
      }
      if (char === '$') {
        const display = source[position + 1] === '$', delimiter = display ? '$$' : '$'
        const begin = position + delimiter.length
        let end = begin
        while (end < source.length) {
          if (!display && source[end] === '\n') break
          if (source[end] === '\\') { end += 2; continue }
          if (source.startsWith(delimiter, end) && (display || source[end + 1] !== '$')) {
            const value = source.slice(begin, end)
            if (value.trim() && (display || (!/\s/.test(source[begin]) && !/\s/.test(source[end - 1]) && !/\d/.test(source[end + 1] ?? '')))) {
              position = end + delimiter.length
              tokens.push({ type: 'math', value, display, source: source.slice(start, position) })
              literalRanges.push({ start, end: position })
            }
            break
          }
          end++
        }
        if (position !== start) continue
        text(delimiter); position += delimiter.length; continue
      }
      if (source.startsWith('**', position)) {
        position += 2
        if (inStrong) return { tokens, closed: true }
        const inner = parse(true)
        if (inner.closed && inner.tokens.length) tokens.push({ type: 'strong', children: inner.tokens })
        else { text('**'); tokens.push(...inner.tokens); if (inner.closed) text('**') }
        continue
      }
      text(char); position++
    }
    return { tokens, closed: false }
  }
  return { tokens: parse().tokens, literalRanges }
}

export function tokenizeNote(source: string): NoteToken[] {
  return parseNote(source).tokens
}

export function noteMarkdown(source: string) {
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let position = 0, result = ''
  for (const range of parseNote(source).literalRanges) {
    result += escape(source.slice(position, range.start)) + source.slice(range.start, range.end)
    position = range.end
  }
  return result + escape(source.slice(position))
}
