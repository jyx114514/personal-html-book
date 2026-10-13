import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderMathWithTex } from './standalone-math.mjs'
import { assertDocumentationCopies } from './documentation-sync.mjs'

test('formula source injection fails immediately if upstream removes or duplicates the container/SVG', () => {
  const html = '<mjx-container><svg></svg></mjx-container><style>.MathJax{color:inherit}</style>'
  const styles = new Set()
  assert.match(renderMathWithTex(html, 'x &lt; y', styles, 'math_inline'), /<mjx-container data-tex="x &lt; y">/)
  assert.deepEqual([...styles], ['.MathJax{color:inherit}'])
  assert.match(renderMathWithTex(html, '$&amp; $$', new Set(), 'math_inline'), /data-tex="\$&amp; \$\$"/)
  for (const invalid of ['<div><svg></svg></div>', '<mjx-container></mjx-container>', html + html, '<mjx-container data-tex="old"><svg></svg></mjx-container>']) {
    assert.throws(() => renderMathWithTex(invalid, 'x', new Set(), 'math_block'), /data-tex 注入失败/)
  }
})

test('documentation drift fails verification while translated prose and comments remain allowed', () => {
  const zh = '<!-- readme-section: checks -->\n## 检查\n\n```bash\n# 检查\npnpm run verify\n```\n'
  const en = zh.replace('## 检查', '## Checks').replace('# 检查', '# Check')
  assertDocumentationCopies('rules', 'rules', zh, en)
  assert.throws(() => assertDocumentationCopies('rules', 'changed', zh, en), /逐字节/)
  assert.throws(() => assertDocumentationCopies('rules', 'rules', zh, en.replace('checks', 'other')), /不同步/)
  assert.throws(() => assertDocumentationCopies('rules', 'rules', zh, en.replace('pnpm run verify', 'pnpm run build')), /不同步/)
  assert.throws(() => assertDocumentationCopies('rules', 'rules', zh, en + '\n## New section\n'), /标记/)
})
