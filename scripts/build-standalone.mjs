import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir, access, readdir, copyFile, mkdtemp } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createMarkdownRenderer } from 'vitepress'
import { assertStandaloneResources } from './standalone-validation.mjs'
import { renderMathWithTex } from './standalone-math.mjs'
import { courseUi } from '../docs/.vitepress/theme/course-ui.mjs'
import { buildOutlineTree, renderOutlineTree, outlineExcludedClasses } from '../docs/.vitepress/theme/outline-model.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const generated = path.join(root, '.standalone')
const dist = path.join(root, 'dist')
const args = process.argv.slice(2)
// pnpm may forward the separator used in older command examples.
if (args[0] === '--') args.shift()
function fail(message) {
  console.error(`独立 HTML 构建失败：${message}`)
  process.exit(1)
}
const fromMarkdown = args.includes('--from-markdown')
const unknown = args.find(arg => arg.startsWith('--') && !['--all', '--from-markdown'].includes(arg))
if (unknown) fail(`Unknown option: ${unknown}。用法：pnpm run build:standalone <topic> [--from-markdown] 或 pnpm run build:standalone --all`)
let topics = args.filter(arg => !arg.startsWith('--'))
await mkdir(dist, { recursive: true })
if (!topics.length || args.includes('--all')) {
  topics = [...new Set([...topics, ...(await readdir(dist)).filter(name => name.endsWith('.html')).map(name => name.slice(0, -5))])]
  if (!topics.length) fail('dist/ 中没有已有主题。新克隆不包含教材数据；请先准备 content/<topic>/manifest.json 及清单中的 Markdown 章节，然后运行 pnpm run build:standalone <topic>。')
}
const manifests = new Map()
for (const topic of topics) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic)) fail(`Invalid topic: ${topic}`)
  const manifestPath = path.join(root, 'content', topic, 'manifest.json')
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') fail(`未找到 content/${topic}/manifest.json。请先准备或恢复主题清单；首次导入还需要清单中的 Markdown 章节。`)
    fail(`无法读取 content/${topic}/manifest.json：${error.message}`)
  }
  if (!manifest || manifest.topic !== topic || typeof manifest.title !== 'string' || !manifest.title || manifest.output !== `${topic}.html`) fail(`Invalid manifest: content/${topic}/manifest.json`)
  try { manifest.lang = new Intl.Locale(manifest.lang ?? 'zh-CN').toString() }
  catch { fail(`Invalid lang: content/${topic}/manifest.json`) }
  manifests.set(topic, manifest)
}
await mkdir(generated, { recursive: true })

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

const parserRequire = createRequire(import.meta.resolve('vue/compiler-sfc'))
const mathRequire = createRequire(import.meta.resolve('markdown-it-mathjax3'))
const mathRoot = path.dirname(mathRequire.resolve('mathjax-full/package.json'))
const mathLicense = `/*! MathJax · Copyright (c) 2017-2022 The MathJax Consortium\n${await readFile(path.join(mathRoot, 'LICENSE'), 'utf8')}\n*/`
const { parse: parseHtml } = parserRequire('@vue/compiler-dom')
const modes = { OmicsLab: ['signal','tpm','methyl','hic','mass','flux'], ComputerLab: ['bits','float','address','layout','stack'], GradientDemo: [] }
const clientBundles = new Map()
async function getClientBundle(body) {
  const used = new Set()
  function collect(node) {
    const name = node.props?.find(prop => prop.type === 6 && prop.name.toLowerCase() === 'data-course-component')?.value?.content
    if (Object.hasOwn(modes, name)) used.add(name)
    for (const child of node.children ?? []) collect(child)
  }
  collect(parseHtml(body, { parseMode: 'html' }))
  const names = Object.keys(modes).filter(name => used.has(name))
  const key = names.join('-') || 'native'
  if (clientBundles.has(key)) return clientBundles.get(key)
  const entry = path.join(generated, `client-${key}.ts`)
  await writeFile(entry, [
    "import { mountStandalone } from '../standalone/main'",
    ...(names.length ? [
      "import { createSSRApp } from 'vue'",
      ...names.map(name => `import ${name} from '../docs/.vitepress/theme/components/${name}.vue'`),
      `const labs = { ${names.join(', ')} }
for (const island of Array.from(document.querySelectorAll<HTMLElement>('[data-course-component]'))) {
  const name = island.dataset.courseComponent as keyof typeof labs
  if (!Object.hasOwn(labs, name)) continue
  createSSRApp(labs[name], island.dataset.mode ? { mode: island.dataset.mode } : {}).mount(island)
}`,
    ] : []),
    'mountStandalone()',
  ].join('\n'))
  const client = await build({
    root, configFile: false, plugins: [vue()],
    resolve: { alias: { 'mathjax-full': mathRoot } },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, assetsInlineLimit: 10000000, cssCodeSplit: false,
      lib: { entry, name: 'CourseInteractions', formats: ['iife'] },
      rollupOptions: { output: { inlineDynamicImports: true, banner: mathLicense } } },
  })
  const outputs = (Array.isArray(client) ? client : [client]).flatMap(result => result.output)
  const chunks = outputs.filter(file => file.type === 'chunk')
  if (chunks.length !== 1 || outputs.some(file => file.type === 'asset' && !file.fileName.endsWith('.css'))) throw new Error('Unbundled resources')
  const bundle = {
    js: chunks[0].code.replace(/<\/script/gi, '<\\/script'),
    css: outputs.filter(file => file.type === 'asset').map(file => file.source).join('\n'),
  }
  clientBundles.set(key, bundle)
  return bundle
}
const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
const plain = text => {
  const collect = node => node.type === 2 ? node.content : (node.children ?? []).map(collect).join('')
  return collect(parseHtml(text, { parseMode: 'html' })).replace(/\u200b/g, '').trim()
}
let renderer
async function importMarkdown(topic, manifest) {
  const ui = courseUi(manifest.lang)
  const source = path.join(root, 'content', topic)
  if (!Array.isArray(manifest.chapters) || !manifest.chapters.length || new Set(manifest.chapters).size !== manifest.chapters.length) throw new Error('Invalid chapters')
  // VitePress caches the renderer: install extensions once for a multi-topic export.
  if (!renderer) {
    renderer = await createMarkdownRenderer(root, { math: true })
    renderer.core.ruler.push('course-no-author-style', state => {
      const hasStyle = tokens => tokens.some(token =>
        (token.type.startsWith('html_') && /<style\b/i.test(token.content)) || (token.children && hasStyle(token.children)))
      if (hasStyle(state.tokens)) throw new Error(`content/${state.env.courseTopic}：Markdown 中不允许 <style> 块；请复用共享样式，不得编写单页专属 CSS。`)
    })
    const tableOpen = renderer.renderer.rules.table_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options))
    const tableClose = renderer.renderer.rules.table_close || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options))
    renderer.renderer.rules.table_open = (...args) => `<div class="course-table-scroll" role="region" aria-label="${escape(courseUi(args[3].courseLang).table)}" tabindex="0">${tableOpen(...args)}`
    renderer.renderer.rules.table_close = (...args) => `${tableClose(...args)}</div>`
    for (const type of ['math_inline', 'math_block']) {
      const rule = renderer.renderer.rules[type]
      if (typeof rule !== 'function') throw new Error(`Missing MathJax renderer: ${type}`)
      renderer.renderer.rules[type] = (...args) => {
        const tex = escape(args[0][args[1]].content)
        return renderMathWithTex(rule(...args), tex, args[3].courseMathStyles, type)
      }
    }
  }
  const chapters = []
  const mathStyles = new Set()
  for (const chapter of manifest.chapters) {
    const target = path.resolve(source, chapter)
    if (!target.startsWith(source + path.sep) || !target.endsWith('.md')) throw new Error('Invalid chapter path')
    await access(target)
    chapters.push(await readFile(target, 'utf8'))
  }
  // A single render gives the anchor plugin a book-wide slug namespace.
  const env = { courseTopic: topic, courseLang: manifest.lang, courseMathStyles: mathStyles }
  let article = renderer.render(chapters.join('\n\n'), env) + '\n'
  const replacements = []
  async function convert(node) {
    if (node.type === 1 && ['CoursePanel', ...Object.keys(modes)].includes(node.tag)) {
      const attrs = new Map(node.props.map(prop => {
        if (prop.type !== 6) throw new Error('组件只支持静态属性：' + node.tag)
        return [prop.name, prop.value?.content ?? '']
      }))
      const raw = node.loc.source
      if (node.tag === 'CoursePanel') {
        if (!attrs.has('title') || [...attrs.keys()].some(key => key !== 'title')) throw new Error('CoursePanel 需要静态 title 属性')
        const openEnd = raw.match(/^<(?:[^>"']|"[^"]*"|'[^']*')*>/)?.[0].length
        if (!openEnd || !raw.endsWith('</CoursePanel>')) throw new Error('CoursePanel 需要闭合标签')
        replacements.push({ start: node.loc.start.offset, end: node.loc.start.offset + openEnd, text: '<section class="course-panel"><div class="course-panel__title">' + escape(attrs.get('title')) + '</div>' })
        replacements.push({ start: node.loc.end.offset - '</CoursePanel>'.length, end: node.loc.end.offset, text: '</section>' })
      } else {
        const mode = attrs.get('mode')
        if ([...attrs.keys()].some(key => key !== 'mode') || (modes[node.tag].length ? !modes[node.tag].includes(mode) : mode !== undefined)) throw new Error('Invalid mode for ' + node.tag + ': ' + String(mode))
        if (node.children.length) throw new Error('实验组件不接受正文：' + node.tag)
        const render = await getLabRenderer()
        replacements.push({ start: node.loc.start.offset, end: node.loc.end.offset, text: '<div data-course-component="' + node.tag + '"' + (mode ? ' data-mode="' + mode + '"' : '') + '>' + await render(node.tag, mode) + '</div>' })
      }
    }
    for (const child of node.children ?? []) await convert(child)
  }
  await convert(parseHtml(article, { parseMode: 'html' }))
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) article = article.slice(0, replacement.start) + replacement.text + article.slice(replacement.end)
  article = article.replace(/\s+v-pre=""/g, '')
  if (/<\/?[A-Z][A-Za-z]*\b/.test(article)) throw new Error('Unconverted component in article；Markdown 导入仅允许小写原生 HTML 标签（例如 <b>）；组件须使用构建器白名单。')
  const descendants = node => (node.children ?? []).flatMap(child => [child, ...descendants(child)])
  const attribute = (node, name) => node.props?.find(prop => prop.type === 6 && prop.name === name)?.value?.content
  const nodes = []
  function collect(node) {
    const classes = attribute(node, 'class')?.split(/\s+/) ?? []
    if (node.type === 1 && (node.props.some(prop => prop.name === 'data-course-component') || attribute(node, 'data-course-outline') === 'exclude' || classes.some(name => outlineExcludedClasses.includes(name)))) return
    nodes.push(node)
    for (const child of node.children ?? []) collect(child)
  }
  const tree = parseHtml(article, { parseMode: 'html' })
  for (const child of tree.children) collect(child)
  const allNodes = descendants(tree)
  const sourceNav = allNodes.find(node => attribute(node, 'class')?.split(/\s+/).includes('course-outline-source'))
  const records = new Map(nodes.filter(node => /^h[2-6]$/.test(node.tag) && attribute(node, 'id')).map(node => [node, { href: '#' + attribute(node, 'id'), title: plain(node.loc.source), level: Number(node.tag.slice(1)) }]))
  for (const link of sourceNav ? descendants(sourceNav).filter(node => node.tag === 'a' && attribute(node, 'href')?.startsWith('#')) : []) {
    const href = attribute(link, 'href')
    let id = href.slice(1)
    try { id = decodeURIComponent(id) } catch { /* Keep literal hash. */ }
    const target = nodes.find(node => attribute(node, 'id') === id)
    if (target) records.set(target, { href, title: plain(link.loc.source), level: records.get(target)?.level ?? 2 })
  }
  const items = [...records.entries()].sort(([a], [b]) => a.loc.start.offset - b.loc.start.offset).map(([, item]) => item)
  const nav = renderOutlineTree(buildOutlineTree(items))
  const body = `<main class="textbook course-shell">
  <aside class="course-outline" aria-label="${escape(ui.outline)}">
    <div class="outline-heading">${escape(ui.heading)}</div>
    <button class="outline-toggle" type="button" aria-expanded="false" aria-controls="course-outline-links" data-expand-label="${escape(ui.expand)}" data-collapse-label="${escape(ui.collapse)}">${escape(ui.expand)}</button>
    <nav id="course-outline-links" aria-label="${escape(ui.navigation)}"><ol>
${nav}
    </ol></nav>
  </aside>
  <div class="course-body">
    <article class="vp-doc">
${article}
    </article>
  </div>
</main>`
  return { body, mathCss: [...mathStyles].join('\n') }
}

for (const topic of topics) {
  const manifest = manifests.get(topic)
  const target = path.join(dist, manifest.output)
  let previous
  try { previous = await readFile(target, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
  const existingBody = previous?.match(/<!-- course:body:start -->(?:\r?\n)?([\s\S]*?)(?:\r?\n)?<!-- course:body:end -->/)
  if (previous !== undefined && (!existingBody ||
    previous.split('<!-- course:body:start -->').length !== 2 ||
    previous.split('<!-- course:body:end -->').length !== 2)) {
    fail('正文保护标记缺失、重复或顺序错误：' + manifest.output + '；请恢复唯一且有序的 course:body:start/end 标记后重试。')
  }
  let body, mathCss, title, lang
  if (existingBody && !fromMarkdown) {
    body = existingBody[1]
    mathCss = previous.match(/<style id="course-math-styles">([\s\S]*?)<\/style>/)?.[1] ?? ''
    title = previous.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? escape(manifest.title)
    const htmlNode = parseHtml(previous, { parseMode: 'html' }).children.find(node => node.tag === 'html')
    lang = escape(htmlNode?.props.find(prop => prop.type === 6 && prop.name === 'lang')?.value?.content ?? manifest.lang)
  } else {
    ;({ body, mathCss } = await importMarkdown(topic, manifest))
    title = escape(manifest.title)
    lang = escape(manifest.lang)
  }
  const { js, css } = await getClientBundle(body)
  if (previous) {
    const backupRoot = path.join(root, 'internal', 'html-export-backups')
    await mkdir(backupRoot, { recursive: true })
    const backup = await mkdtemp(path.join(backupRoot, new Date().toISOString().replace(/[:.]/g, '-') + '-'))
    await copyFile(target, path.join(backup, manifest.output))
  }
  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="course-body-format" content="native-html-v1">
  <meta name="course-topic" content="${topic}">
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
  assertStandaloneResources(html)
  await writeFile(target, html)
  console.log(`Built dist/${manifest.output} (${Buffer.byteLength(html)} bytes; ${existingBody && !fromMarkdown ? 'preserved editable HTML body' : 'imported Markdown to native HTML'})`)
}
