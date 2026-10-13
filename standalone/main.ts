import { mountOutline } from '../docs/.vitepress/theme/outline'
import { courseUi } from '../docs/.vitepress/theme/course-ui.mjs'
import { createSSRApp } from 'vue'
import GradientDemo from '../docs/.vitepress/theme/components/GradientDemo.vue'
import OmicsLab from '../docs/.vitepress/theme/components/OmicsLab.vue'
import ComputerLab from '../docs/.vitepress/theme/components/ComputerLab.vue'
import 'vitepress/dist/client/theme-default/styles/vars.css'
import 'vitepress/dist/client/theme-default/styles/base.css'
import 'vitepress/dist/client/theme-default/styles/components/vp-doc.css'
import '../docs/.vitepress/theme/custom.css'
import './layout.css'
import '../docs/.vitepress/theme/outline.css'

// Only experiment islands are hydrated. The article is never a Vue template.
const labs = { GradientDemo, OmicsLab, ComputerLab }
for (const island of Array.from(document.querySelectorAll<HTMLElement>('[data-course-component]'))) {
  const name = island.dataset.courseComponent as keyof typeof labs
  if (!Object.hasOwn(labs, name)) continue
  createSSRApp(labs[name], island.dataset.mode ? { mode: island.dataset.mode } : {}).mount(island)
}

mountOutline(document)

for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('button.copy'))) {
  button.type = 'button'
  if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', courseUi(document.documentElement.lang || 'zh-CN').copy)
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
