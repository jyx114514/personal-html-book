import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

function readmeContract(markdown, name) {
  // Ignore translated prose and code comments. Stable section IDs expose additions,
  // removals and reordering; runnable examples must agree across languages.
  const sections = [...markdown.matchAll(/^<!-- readme-section: ([a-z-]+) -->\r?\n(#{2,6}) /gm)]
    .map(match => [match[1], match[2].length])
  const headings = [...markdown.matchAll(/^#{2,6} /gm)]
  assert.ok(sections.length > 0 && sections.length === headings.length, `${name}: 每个章节标题前必须有 readme-section 标记`)
  assert.equal(new Set(sections.map(([id]) => id)).size, sections.length, `${name}: 重复 readme-section 标记`)
  const examples = [...markdown.matchAll(/^```([^\r\n]*)\r?\n([\s\S]*?)^```/gm)].map(([, language, source]) => {
    if (language === 'json') {
      const value = JSON.parse(source)
      // Only the displayed book title is localized in the manifest example.
      if (Object.hasOwn(value, 'title')) value.title = '<localized title>'
      return [language, value]
    }
    if (language === 'bash') return [language, source.split(/\r?\n/).filter(line => !/^\s*#/.test(line)).map(line => line.trim()).filter(Boolean)]
    return [language] // The directory tree contains translated explanatory prose.
  })
  return { sections, examples }
}

export function assertDocumentationCopies(skill, localSkill, chinese, english) {
  assert.ok(Buffer.from(skill).equals(Buffer.from(localSkill)), 'SKILL.md 与 .agents/skills/dialogue-to-course/SKILL.md 必须逐字节相同')
  assert.deepEqual(readmeContract(chinese, 'README.md'), readmeContract(english, 'README.en.md'), 'README 中英文章节结构或可执行示例不同步（翻译语义仍需人工核对）')
}

export function renderAgentInstructions(skill) {
  const source = skill.toString().replace(/\r\n/g, '\n')
  const start = '<!-- agent-entry:start -->', end = '<!-- agent-entry:end -->'
  assert.equal(source.split(start).length, 2, 'SKILL.md 必须有唯一的 agent-entry:start 标记')
  assert.equal(source.split(end).length, 2, 'SKILL.md 必须有唯一的 agent-entry:end 标记')
  assert.ok(source.indexOf(start) < source.indexOf(end), 'agent-entry 标记顺序错误')
  const entry = source.slice(source.indexOf(start) + start.length, source.indexOf(end)).trim()
  assert.ok(entry.startsWith('# Agent 项目指令\n'), 'Agent 入口必须包含项目标题')
  return entry + '\n'
}

export function assertAgentInstructions(skill, agents) {
  assert.equal(agents.toString().replace(/\r\n/g, '\n'), renderAgentInstructions(skill), 'AGENTS.md 偏离 SKILL.md 唯一规范源；请修改根目录 SKILL.md 后运行 pnpm run sync:agents')
}

export async function assertDocumentationSync(root) {
  const files = ['SKILL.md', '.agents/skills/dialogue-to-course/SKILL.md', 'README.md', 'README.en.md', 'AGENTS.md']
  const [skill, localSkill, chinese, english, agents] = await Promise.all(files.map(file => readFile(path.join(root, file))))
  assertDocumentationCopies(skill, localSkill, chinese.toString('utf8'), english.toString('utf8'))
  assertAgentInstructions(skill, agents)
  for (const guide of ['authoring', 'maintenance']) {
    const names = [`handbook/${guide}.md`, `handbook/${guide}.en.md`]
    const copies = await Promise.all(names.map(file => readFile(path.join(root, file), 'utf8')))
    assert.deepEqual(readmeContract(copies[0], names[0]), readmeContract(copies[1], names[1]), `${guide} 中英文结构或可执行示例不同步`)
  }
}
