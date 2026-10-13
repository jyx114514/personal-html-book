import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'vitepress'

const docs = fileURLToPath(new URL('../docs/', import.meta.url))
try {
  await access(new URL('../docs/index.md', import.meta.url))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  console.error('网站构建失败：未找到 docs/index.md。新克隆不包含网站页面；请先准备或恢复首页、章节与资源，再运行 pnpm run build。独立 HTML 请使用 pnpm run build:standalone <topic>。')
  process.exit(1)
}
await build(docs)
