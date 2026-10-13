import { readFile, writeFile, mkdir, access, readdir, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createMarkdownRenderer } from 'vitepress'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const generated = path.join(root, '.standalone')
const dist = path.join(root, 'dist')
const args = process.argv.slice(2)
const fromMarkdown = args.includes('--from-markdown')
if (args.some(arg => arg.startsWith('--') && !['--all', '--from-markdown'].includes(arg))) throw new Error('Unknown option')
let topics = args.filter(arg => !arg.startsWith('--'))
await mkdir(dist, { recursive: true })
if (!topics.length || args.includes('--all')) {
  topics = [...new Set([...topics, ...(await readdir(dist)).filter(name => name.endsWith('.html')).map(name => name.slice(0, -5))])]
  if (!topics.length) topics = ['style-sample']
}
for (const topic of topics) if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic)) throw new Error('Invalid topic')
await mkdir(generated, { recursive: true })

const client = await build({
  root, configFile: false, plugins: [vue()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: { write: false, assetsInlineLimit: 10000000, cssCodeSplit: false,
    lib: { entry: path.join(root, 'standalone/main.ts'), name: 'CourseInteractions', formats: ['iife'] },
    rollupOptions: { output: { inlineDynamicImports: true } } }
})
const outputs = (Array.isArray(client) ? client : [client]).flatMap(result => result.output)
const chunks = outputs.filter(file => file.type === 'chunk')
if (chunks.length !== 1 || outputs.some(file => file.type === 'asset' && !file.fileName.endsWith('.css'))) throw new Error('Unbundled resources')
const js = chunks[0].code.replace(/<\/script/gi, '<\\/script')
const outline = await readFile(path.join(root, 'docs/.vitepress/theme/components/CourseOutline.vue'), 'utf8')
// Reuse existing shared outline rules verbatim without altering the theme.
const outlineCss = outline.match(/<style scoped>([\s\S]*?)<\/style>/)[1]
const css = outputs.filter(file => file.type === 'asset').map(file => file.source).join('\n') + '\n' + outlineCss

let renderLab
async function getLabRenderer() {
  if (renderLab) return renderLab
  const entry = path.join(generated, 'labs.ts')
  await writeFile(entry, `import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import GradientDemo from '../docs/.vitepress/theme/components/GradientDemo.vue'
import OmicsLab from '../docs/.vitepress/theme/components/OmicsLab.vue'
import ComputerLab from '../docs/.vitepress/theme/components/ComputerLab.vue'
const labs = { GradientDemo, OmicsLab, ComputerLab }
export async function renderLab(name, mode) { return renderToString(createSSRApp(labs[name], mode ? { mode } : {})) }
`)
  const result = await build({ root, configFile: false, plugins: [vue()],
    build: { ssr: entry, write: false, minify: false, rollupOptions: { output: { inlineDynamicImports: true } } } })
  const chunk = result.output.find(file => file.type === 'chunk')
  const target = path.join(generated, 'labs.mjs')
  await writeFile(target, chunk.code)
  renderLab = (await import(pathToFileURL(target).href)).renderLab
  return renderLab
}

const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
const plain = text => text.replace(/<[^>]+>/g, '').replace(/&ZeroWidthSpace;|\u200b/g, '').trim()
let renderer
async function importMarkdown(topic, manifest) {
  const source = path.join(root, 'content', topic)
  if (!Array.isArray(manifest.chapters) || !manifest.chapters.length || new Set(manifest.chapters).size !== manifest.chapters.length) throw new Error('Invalid chapters')
  // VitePress caches the renderer: install extensions once for a multi-topic export.
  if (!renderer) {
    renderer = await createMarkdownRenderer(root, { math: true })
    const tableOpen = renderer.renderer.rules.table_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options))
    const tableClose = renderer.renderer.rules.table_close || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options))
    renderer.renderer.rules.table_open = (...args) => `<div class="course-table-scroll" role="region" aria-label="可横向滚动的数据表" tabindex="0">${tableOpen(...args)}`
    renderer.renderer.rules.table_close = (...args) => `${tableClose(...args)}</div>`
    for (const type of ['math_inline', 'math_block']) {
      const rule = renderer.renderer.rules[type]
      renderer.renderer.rules[type] = (...args) => {
        const tex = escape(args[0][args[1]].content)
        return rule(...args).replace(/<span id="mjx-/, `<span data-tex="${tex}" id="mjx-`)
      }
    }
  }
  let article = ''
  const mathStyles = []
  for (const chapter of manifest.chapters) {
    const target = path.resolve(source, chapter)
    if (!target.startsWith(source + path.sep) || !target.endsWith('.md')) throw new Error('Invalid chapter path')
    await access(target)
    article += renderer.render(await readFile(target, 'utf8')).replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, style) => { mathStyles.push(style); return '' }) + '\n'
  }
  article = article.replace(/<CoursePanel title="([^"]*)">/g, '<section class="course-panel"><div class="course-panel__title">$1</div>')
    .replace(/<\/CoursePanel>/g, '</section>').replace(/\s+v-pre=""/g, '')
  const labs = Array.from(article.matchAll(/<(GradientDemo|OmicsLab|ComputerLab)(?: mode="([a-z]+)")?\s*\/>/g))
  if (labs.length) {
    const render = await getLabRenderer()
    for (const [tag, name, mode] of labs) {
      const html = await render(name, mode)
      article = article.replace(tag, `<div data-course-component="${name}"${mode ? ` data-mode="${mode}"` : ''}>${html}</div>`)
    }
  }
  if (/<\/?[A-Z][A-Za-z]*\b/.test(article)) throw new Error('Unconverted component in article')
  const sourceNav = article.match(/<(nav|div) class="course-outline-source"[^>]*>([\s\S]*?)<\/\1>/)
  const items = sourceNav
    ? Array.from(sourceNav[2].matchAll(/<a href="(#[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)).map(match => ({ href: match[1], title: plain(match[2]) }))
    : Array.from(article.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)).map(match => ({ href: `#${match[1]}`, title: plain(match[2]) }))
  const nav = items.map(item => `          <li><a href="${item.href}">${item.title}</a></li>`).join('\n')
  const body = `<main class="textbook course-shell">
  <aside class="course-outline" aria-label="教材目录">
    <div class="outline-heading">阅读目录</div>
    <button class="outline-toggle" type="button" aria-expanded="false" aria-controls="course-outline-links">展开目录</button>
    <nav id="course-outline-links" aria-label="章节导航"><ol>
${nav}
    </ol></nav>
  </aside>
  <div class="course-body">
    <article class="vp-doc">
${article}
    </article>
  </div>
</main>`
  return { body, mathCss: mathStyles.join('\n') }
}

for (const topic of topics) {
  const manifest = JSON.parse(await readFile(path.join(root, 'content', topic, 'manifest.json'), 'utf8'))
  if (manifest.topic !== topic || typeof manifest.title !== 'string' || !manifest.title || manifest.output !== `${topic}.html`) throw new Error('Invalid manifest')
  const target = path.join(dist, manifest.output)
  let previous
  try { previous = await readFile(target, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
  const existingBody = previous?.match(/<!-- course:body:start -->\r?\n([\s\S]*?)\r?\n<!-- course:body:end -->/)
  let body, mathCss, title
  if (existingBody && !fromMarkdown) {
    body = existingBody[1]
    mathCss = previous.match(/<style id="course-math-styles">([\s\S]*?)<\/style>/)?.[1] ?? ''
    title = previous.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? escape(manifest.title)
  } else {
    if (previous && !existingBody && /<article\b/i.test(previous.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''))) throw new Error(`Unrecognized editable HTML: ${manifest.output}; refusing to overwrite`)
    ;({ body, mathCss } = await importMarkdown(topic, manifest))
    title = escape(manifest.title)
  }
  if (previous) {
    const backup = path.join(root, 'internal', 'html-export-backups', new Date().toISOString().replace(/[:.]/g, '-'))
    await mkdir(backup, { recursive: true })
    await copyFile(target, path.join(backup, manifest.output))
  }
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="course-body-format" content="native-html-v1">
  <title>${title}</title>
  <style id="course-design-system">${css}</style>
  <style id="course-math-styles">${mathCss}</style>
</head>
<body>
<!-- 正文权威版本：直接编辑下方 HTML；默认重新导出保留这里的修改。 -->
<!-- course:body:start -->
${body}
<!-- course:body:end -->
  <script id="course-interactions">${js}</script>
</body>
</html>
`
  if (/<(?:script|link)\b[^>]*(?:src|href)=/i.test(html) || /(?:src|poster)="(?!data:)[^"]+"/i.test(body) || /url\(\s*["']?(?!data:|#)[^\s)"']+/i.test(css + mathCss)) throw new Error('External resource reference')
  await writeFile(target, html)
  console.log(`Built dist/${manifest.output} (${Buffer.byteLength(html)} bytes; ${existingBody && !fromMarkdown ? 'preserved editable HTML body' : 'imported Markdown to native HTML'})`)
}
