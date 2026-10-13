import { createSSRApp } from 'vue'
import GradientDemo from '../docs/.vitepress/theme/components/GradientDemo.vue'
import OmicsLab from '../docs/.vitepress/theme/components/OmicsLab.vue'
import ComputerLab from '../docs/.vitepress/theme/components/ComputerLab.vue'
import 'vitepress/dist/client/theme-default/styles/vars.css'
import 'vitepress/dist/client/theme-default/styles/base.css'
import 'vitepress/dist/client/theme-default/styles/components/vp-doc.css'
import '../docs/.vitepress/theme/custom.css'
import './layout.css'

// Only experiment islands are hydrated. The article is never a Vue template.
const labs = { GradientDemo, OmicsLab, ComputerLab }
for (const island of Array.from(document.querySelectorAll<HTMLElement>('[data-course-component]'))) {
  const name = island.dataset.courseComponent as keyof typeof labs
  if (!labs[name]) continue
  createSSRApp(labs[name], island.dataset.mode ? { mode: island.dataset.mode } : {}).mount(island)
}

const nav = document.querySelector<HTMLElement>('#course-outline-links')
const toggle = document.querySelector<HTMLButtonElement>('.outline-toggle')
const media = matchMedia('(max-width: 800px)')
let expanded = false
let frame = 0
const links = Array.from(nav?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]') ?? [])
const targets = links.flatMap(link => {
  const element = document.getElementById(decodeURIComponent(link.hash.slice(1)))
  return element ? [{ link, element }] : []
})
function setExpanded(value: boolean) {
  expanded = value
  if (nav) nav.hidden = media.matches && !expanded
  toggle?.setAttribute('aria-expanded', String(expanded))
  if (toggle) toggle.textContent = expanded ? '收起目录' : '展开目录'
}
function updateActive() {
  frame = 0
  let current = targets[0]
  for (const target of targets) {
    if (target.element.getBoundingClientRect().top <= 140) current = target
    else break
  }
  for (const target of targets) {
    if (target === current) target.link.setAttribute('aria-current', 'location')
    else target.link.removeAttribute('aria-current')
  }
}
function onScroll() { if (!frame) frame = requestAnimationFrame(updateActive) }
toggle?.addEventListener('click', () => setExpanded(!expanded))
media.addEventListener('change', () => { setExpanded(false); onScroll() })
for (const { link, element } of targets) {
  link.addEventListener('click', event => {
    event.preventDefault()
    setExpanded(false)
    if (location.hash !== link.hash) history.pushState(null, '', link.hash)
    element.scrollIntoView({ block: 'start' })
    element.setAttribute('tabindex', '-1')
    element.focus({ preventScroll: true })
    updateActive()
  })
}
window.addEventListener('scroll', onScroll, { passive: true })
window.addEventListener('hashchange', onScroll)
setExpanded(false)
updateActive()

for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('button.copy'))) {
  button.type = 'button'
  button.setAttribute('aria-label', '复制代码')
  button.addEventListener('click', async () => {
    const text = button.parentElement?.querySelector('pre code')?.textContent ?? ''
    try {
      await navigator.clipboard.writeText(text)
      button.classList.add('copied')
      setTimeout(() => button.classList.remove('copied'), 2000)
    } catch {
      const code = button.parentElement?.querySelector('pre code')
      if (code) {
        const range = document.createRange()
        range.selectNodeContents(code)
        getSelection()?.removeAllRanges()
        getSelection()?.addRange(range)
      }
    }
  })
}
