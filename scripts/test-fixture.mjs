import { cp, mkdir, mkdtemp, symlink, unlink, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
export async function createFixture() {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const internal = path.resolve(root, 'internal')
  await mkdir(internal, { recursive: true })
  const fixture = await mkdtemp(path.join(internal, 'verification-'))
  let linked = false
  const cleanup = async () => {
    if (path.dirname(path.resolve(fixture)) !== internal) throw new Error('Unsafe fixture cleanup path')
    if (linked) { await unlink(path.join(fixture, 'node_modules')); linked = false }
    await rm(fixture, { recursive: true, force: true })
  }
  try {
    for (const entry of ['scripts', 'standalone', 'docs/.vitepress/theme', 'docs/.vitepress/config.mts', 'package.json']) await cp(path.join(root, entry), path.join(fixture, entry), { recursive: true })
    await symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    linked = true
    return { fixture, cleanup }
  } catch (error) { await cleanup(); throw error }
}
