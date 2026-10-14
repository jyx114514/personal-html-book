import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderMathWithTex } from './standalone-math.mjs'
import { assertDocumentationCopies, assertAgentInstructions, renderAgentInstructions } from './documentation-sync.mjs'

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

test('agent instructions are generated from one source and drift or malformed boundaries fail', () => {
  const skill = 'Other rules\n<!-- agent-entry:start -->\n# Agent 项目指令\n\nRead SKILL.md.\n<!-- agent-entry:end -->\n'
  const agents = renderAgentInstructions(skill)
  assertAgentInstructions(skill, agents)
  assertAgentInstructions(skill, agents.replaceAll('\n', '\r\n'))
  assert.throws(() => assertAgentInstructions(skill, agents.replace('Read', 'Ignore')), /偏离/)
  assert.throws(() => assertAgentInstructions(skill.replace('Read', 'Follow'), agents), /偏离/)
  for (const malformed of [skill.replace('<!-- agent-entry:end -->', ''), skill + '<!-- agent-entry:start -->', skill.replace(/agent-entry:(start|end)/g, (_, side) => 'agent-entry:' + (side === 'start' ? 'end' : 'start'))]) {
    assert.throws(() => renderAgentInstructions(malformed), /标记/)
  }
})
