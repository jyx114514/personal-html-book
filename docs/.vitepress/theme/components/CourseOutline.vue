<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { mountOutline } from '../outline'
import { buildOutlineTree, collectDomOutline, renderOutlineTree } from '../outline-model.mjs'
import '../outline.css'
const shell = ref<HTMLElement | null>(null)
const items = ref('')
let cleanup: (() => void) | undefined
let disposed = false
onMounted(async () => {
  const article = shell.value?.querySelector('article')
  if (!article) return
  items.value = renderOutlineTree(buildOutlineTree(collectDomOutline(article)))
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
      <nav id="course-outline-links" aria-label="章节导航"><ol v-html="items" /></nav>
    </aside>
    <div class="course-body"><slot /></div>
  </div>
</template>
