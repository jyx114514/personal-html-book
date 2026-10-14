import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertAgentInstructions, renderAgentInstructions } from './documentation-sync.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
if (args.length !== 1 || !['--write', '--check'].includes(args[0])) throw new Error('用法：pnpm run sync:agents（生成副本）或 node scripts/sync-agent-instructions.mjs --check（只检查）')
const skill = await readFile(path.join(root, 'SKILL.md'))
const agents = renderAgentInstructions(skill)
const local = path.join(root, '.agents/skills/dialogue-to-course/SKILL.md')
if (args[0] === '--write') {
  await writeFile(path.join(root, 'AGENTS.md'), agents)
  await writeFile(local, skill)
  console.log('已从根目录 SKILL.md 生成 AGENTS.md，并逐字节同步 Skill 副本。')
} else {
  assertAgentInstructions(skill, await readFile(path.join(root, 'AGENTS.md')))
  if (!skill.equals(await readFile(local))) throw new Error('SKILL 副本漂移；运行 pnpm run sync:agents')
  console.log('AGENTS 入口与 Skill 副本同步检查通过。')
}
