import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderMathWithTex } from './standalone-math.mjs'
import { assertDocumentationCopies, assertAgentInstructions, renderAgentInstructions } from './documentation-sync.mjs'
import { extractDiagramExample, extractInteractionScript, stripDiagramAnimation, parsePrivateTerms } from './verification-inputs.mjs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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

test('diagram extraction accepts formatting changes and diagnoses missing or ambiguous examples', () => {
  const html = '<figure\n class="diagram"\n data-course-animation="">\n<svg viewBox="0 0 10 10"></svg>\n</figure>'
  const guide = '```html\n<p>Unrelated example.</p>\n```\n\n~~~html  \n' + html + '\n~~~\n'
  assert.equal(extractDiagramExample(guide), html)
  assert.equal(extractDiagramExample(guide.replaceAll('\n', '\r\n')), html.replaceAll('\n', '\r\n'))
  assert.throws(() => extractDiagramExample('No example.'), /handbook\/authoring\.md.*<figure data-course-animation>.*0 个/)
  assert.throws(() => extractDiagramExample(guide + guide), /实际找到 2 个/)
  assert.throws(() => extractDiagramExample('```html\n<figure data-course-animation>\n```'), /handbook\/authoring\.md.*HTML 结构无法解析/)
})

test('interaction script extraction tolerates attributes and provides contextual structure errors', () => {
  const html = '<script\n type="text/javascript" id=\'course-interactions\'>const sample = "ok";\n</script>'
  assert.equal(extractInteractionScript(html, 'book.html'), 'const sample = "ok";\n')
  for (const invalid of ['<script id="other">x()</script>', html + html]) {
    assert.throws(() => extractInteractionScript(invalid, 'book.html'), /book\.html.*course-interactions.*导出结构/)
  }
  assert.throws(() => extractInteractionScript('<script id="course-interactions" src="app.js"></script>', 'book.html'), /book\.html.*内嵌脚本/)
})

test('static diagram fixtures remove multiline animation markup without splitting Markdown HTML blocks', () => {
  const html = '<figure\n data-course-animation=""\n>\n  <svg><circle cx="40">\n    <animate\n attributeName="cx" begin="indefinite"\n></animate>\n  </circle></svg>\n  <div\n data-course-animation-controls hidden\n>\n    <button>Play</button>\n  </div>\n  <figcaption>Static explanation.</figcaption>\n</figure>'
  for (const input of [html, html.replaceAll('\n', '\r\n')]) {
    const result = stripDiagramAnimation(input)
    assert.doesNotMatch(result, /data-course-animation|<animate|<button|\n[\t \r]*\n/)
    assert.ok(result.includes('<circle cx="40">'))
    assert.ok(result.includes('<figcaption>Static explanation.</figcaption>'))
  }
})

test('private terms parsing names the environment variable and fails before launching a browser', () => {
  assert.deepEqual(parsePrivateTerms(undefined), [])
  assert.deepEqual(parsePrivateTerms('[]'), [])
  assert.deepEqual(parsePrivateTerms('["identifier", "标识"]'), ['identifier', '标识'])
  for (const raw of ['{', '', 'not-json']) assert.throws(() => parsePrivateTerms(raw), /COURSE_PRIVATE_TERMS JSON 解析失败/)
  for (const raw of ['{}', 'null', '42', '[1]', '[""]']) assert.throws(() => parsePrivateTerms(raw), /COURSE_PRIVATE_TERMS 必须是由非空字符串组成的 JSON 数组/)
  assert.throws(() => execFileSync(process.execPath, ['scripts/verify-native-html.mjs'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'pipe', env: { ...process.env, COURSE_PRIVATE_TERMS: 'not-json' },
  }), error => error.status !== 0 && /浏览器验收失败：COURSE_PRIVATE_TERMS JSON 解析失败/.test(String(error.stderr)) && !/SyntaxError/.test(String(error.stderr)))
})
