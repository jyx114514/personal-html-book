import { tokenizeNote, type NoteToken } from './annotation-format-model'
import { renderNoteMath } from './annotation-math.mjs'

export function formatNote(source: string) {
  const content = document.createElement('div')
  content.className = 'course-note-text'
  function append(parent: HTMLElement, tokens: NoteToken[]) {
    for (const token of tokens) {
      if (token.type === 'text') parent.append(document.createTextNode(token.value))
      else if (token.type === 'strong') {
        const strong = document.createElement('strong'); append(strong, token.children); parent.append(strong)
      } else if (token.type === 'code') {
        const code = document.createElement('code'); code.textContent = token.value; parent.append(code)
      } else {
        const math = renderNoteMath(token.value, token.display)
        if (!math) { parent.append(document.createTextNode(token.source)); continue }
        const wrap = document.createElement('span')
        wrap.className = `course-note-math${token.display ? ' is-display' : ''}`
        wrap.setAttribute('role', 'math'); wrap.setAttribute('aria-label', token.value); wrap.title = token.value
        wrap.append(math); parent.append(wrap)
      }
    }
  }
  append(content, tokenizeNote(source))
  return content
}
