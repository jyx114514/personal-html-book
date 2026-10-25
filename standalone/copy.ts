import { courseUi } from '../docs/.vitepress/theme/course-ui.mjs'

export function mountCopyButtons(scope: ParentNode) {
  const ui = courseUi(document.documentElement.lang || 'zh-CN')
  for (const button of Array.from(scope.querySelectorAll<HTMLButtonElement>('button.copy'))) {
    const block = button.closest('div[class*="language-"], .code') ?? button.parentElement
    if (!block) continue
    button.type = 'button'
    if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', ui.copy)
    const nativeLabel = !block.matches('div[class*="language-"]')
    if (nativeLabel && !button.textContent?.trim()) button.textContent = ui.copy
    const originalLabel = Array.from(button.childNodes)
    const status = document.createElement('p')
    status.className = 'course-copy-status'
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    status.setAttribute('aria-atomic', 'true')
    block.append(status)
    let timer = 0
    let attempt = 0
    const resetFeedback = () => {
      button.classList.remove('copied')
      if (nativeLabel) button.replaceChildren(...originalLabel)
    }
    const announce = (text: string, visible = false) => {
      status.textContent = text
      status.toggleAttribute('data-visible', visible)
    }
    button.addEventListener('click', async () => {
      const current = ++attempt
      clearTimeout(timer)
      resetFeedback()
      announce('')
      const code = block.querySelector('pre code') ?? block.querySelector('pre')
      if (!code) { announce(ui.copyFailed, true); return }
      try {
        await navigator.clipboard.writeText(code.textContent ?? '')
        if (current !== attempt) return
        button.classList.add('copied')
        if (nativeLabel) button.textContent = ui.copied
        announce(ui.copied)
        timer = window.setTimeout(() => { resetFeedback(); announce('') }, 2000)
      } catch {
        if (current !== attempt) return
        try {
          const selection = getSelection()
          if (!selection || !code.textContent) throw new Error('No selectable code')
          const range = document.createRange()
          range.selectNodeContents(code)
          selection.removeAllRanges()
          selection.addRange(range)
          announce(ui.copySelected, true)
        } catch { announce(ui.copyFailed, true) }
      }
    })
  }
}
