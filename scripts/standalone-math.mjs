// Fail on every unexpected formula shape, before an output file can be written.
export function renderMathWithTex(html, escapedTex, styles, type) {
  const marker = /<mjx-container\b/g
  const count = [...html.matchAll(marker)].length
  const svgCount = [...html.matchAll(/<svg\b/g)].length
  if (count !== 1 || svgCount !== 1 || /\bdata-tex\s*=/.test(html)) throw new Error(`MathJax ${type}: data-tex 注入失败（预期 1 个公式容器和 SVG，实际 ${count} 个容器、${svgCount} 个 SVG）；请检查数学插件输出兼容性。`)
  // A callback preserves literal TeX sequences such as $& and $$.
  return html.replace(marker, () => `<mjx-container data-tex="${escapedTex}"`)
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => { styles.add(css); return '' })
}
