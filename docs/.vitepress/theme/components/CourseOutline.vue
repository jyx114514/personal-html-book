<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { mountOutline } from '../outline'
import '../outline.css'
const shell = ref<HTMLElement | null>(null)
const items = ref<{ href: string; title: string }[]>([])
let cleanup: (() => void) | undefined
let disposed = false
onMounted(async () => {
  const article = shell.value?.querySelector('article')
  if (!article) return
  const source = article.querySelector('.course-outline-source')
  items.value = source
    ? Array.from(source.querySelectorAll<HTMLAnchorElement>('a[href^="#"]:not(.header-anchor)')).map(link => ({ href: link.getAttribute('href')!, title: link.textContent?.trim() ?? '' }))
    : Array.from(article.querySelectorAll<HTMLElement>('h2[id]')).map(heading => ({ href: '#' + heading.id, title: heading.textContent?.replace(/\u200b/g, '').trim() ?? '' }))
  await nextTick()
  if (!disposed && shell.value) cleanup = mountOutline(shell.value)
})
onBeforeUnmount(() => { disposed = true; cleanup?.() })
</script>
<template>
  <div ref="shell" class="course-shell">
    <aside class="course-outline" aria-label="教材目录">
      <div class="outline-heading">阅读目录</div>
      <button class="outline-toggle" type="button" aria-expanded="false" aria-controls="course-outline-links">展开目录</button>
      <nav id="course-outline-links" aria-label="章节导航"><ol>
        <li v-for="item in items" :key="item.href"><a :href="item.href">{{ item.title }}</a></li>
      </ol></nav>
    </aside>
    <div class="course-body"><slot /></div>
  </div>
</template>
