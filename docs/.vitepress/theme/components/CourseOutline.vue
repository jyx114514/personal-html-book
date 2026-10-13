<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const shell = ref<HTMLElement | null>(null)
const items = ref<{ href: string; title: string }[]>([])
const active = ref('')
const expanded = ref(false)
const narrow = ref(false)
let targets: { href: string; element: HTMLElement }[] = []
let media: MediaQueryList | undefined
let frame = 0

function updateActive() {
  frame = 0
  let current = targets[0]?.href ?? ''
  for (const target of targets) {
    if (target.element.getBoundingClientRect().top <= 140) current = target.href
    else break
  }
  active.value = current
}
function onScroll() {
  if (!frame) frame = requestAnimationFrame(updateActive)
}
function onResize() {
  narrow.value = media?.matches ?? false
  expanded.value = false
  onScroll()
}
async function navigate(href: string) {
  expanded.value = false
  await nextTick()
  const target = targets.find(item => item.href === href)?.element
  if (!target) return
  if (location.hash !== href) history.pushState(null, '', href)
  target.scrollIntoView({ block: 'start' })
  active.value = href
  target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: true })
}

onMounted(() => {
  const article = shell.value?.querySelector('article')
  if (!article) return
  const source = article.querySelector('.course-outline-source')
  items.value = source
    ? Array.from(source.querySelectorAll<HTMLAnchorElement>('a[href^="#"]:not(.header-anchor)')).map(link => ({ href: link.getAttribute('href')!, title: link.textContent?.trim() ?? '' }))
    : Array.from(article.querySelectorAll<HTMLElement>('h2[id]')).map(heading => ({ href: `#${heading.id}`, title: heading.textContent?.replace(/\u200b/g, '').trim() ?? '' }))
  targets = items.value.flatMap(item => {
    const element = document.getElementById(decodeURIComponent(item.href.slice(1)))
    return element ? [{ href: item.href, element }] : []
  })
  media = matchMedia('(max-width: 800px)')
  onResize()
  media.addEventListener('change', onResize)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('hashchange', onScroll)
  updateActive()
})
onBeforeUnmount(() => {
  media?.removeEventListener('change', onResize)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('hashchange', onScroll)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <div ref="shell" class="course-shell">
    <aside class="course-outline" aria-label="教材目录">
      <div class="outline-heading">阅读目录</div>
      <button class="outline-toggle" type="button" :aria-expanded="expanded" aria-controls="course-outline-links" @click="expanded = !expanded">{{ expanded ? '收起目录' : '展开目录' }}</button>
      <nav v-show="!narrow || expanded" id="course-outline-links" aria-label="章节导航">
        <ol>
          <li v-for="item in items" :key="item.href">
            <a :href="item.href" :aria-current="active === item.href ? 'location' : undefined" @click.prevent="navigate(item.href)">{{ item.title }}</a>
          </li>
        </ol>
      </nav>
    </aside>
    <div class="course-body"><slot /></div>
  </div>
</template>

<style scoped>
.course-outline{position:fixed;inset:0 auto 0 0;width:256px;padding:40px 18px;background:var(--vp-c-bg-soft);border-right:1px solid var(--vp-c-divider);overflow-y:auto;z-index:20}.outline-heading{font-weight:700;font-size:1rem;padding:0 12px 18px;border-bottom:1px solid var(--vp-c-divider)}.course-outline ol{list-style:none;margin:16px 0 0;padding:0}.course-outline li{margin:4px 0}.course-outline a{display:block;padding:10px 12px;border-left:2px solid transparent;border-radius:0 var(--course-radius) var(--course-radius) 0;color:var(--vp-c-text-2);font-size:.875rem;line-height:1.65;overflow-wrap:anywhere;text-decoration:none}.course-outline a:hover{color:var(--vp-c-brand-1);background:var(--vp-c-bg)}.course-outline a[aria-current]{color:var(--vp-c-brand-1);border-left-color:var(--vp-c-brand-1);background:var(--vp-c-brand-soft);font-weight:600}.outline-toggle{display:none;border:1px solid var(--vp-c-divider);background:var(--vp-c-bg);border-radius:var(--course-radius);padding:6px 12px;cursor:pointer;font:inherit;font-size:.875rem}.course-outline :is(a,button):focus-visible{outline:2px solid var(--vp-c-brand-1);outline-offset:2px}
@media(max-width:800px){.course-outline{position:sticky;inset:auto;top:0;width:100%;padding:12px var(--course-space);border-right:0;border-bottom:1px solid var(--vp-c-divider);overflow:visible;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}.outline-heading{padding:0;border:0}.outline-toggle{display:block}.course-outline nav{flex-basis:100%;max-height:65vh;overflow-y:auto}.course-outline ol{margin:4px 0}.course-outline a{padding:8px 12px}}
@media print{.course-outline{display:none}}
</style>
