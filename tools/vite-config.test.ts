import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PluginOption, UserConfig } from 'vite'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { canvasConfig } from '../vite.config.ts'
import { projectVariable, slashes, toolRoot } from './project.ts'

// The config of each of the two servers of `canvas dev`, and of the build,
// for a project outside the tool.

let project = ''
let before: string | undefined

beforeEach(() => {
  before = process.env[projectVariable]
  project = slashes(realpathSync(mkdtempSync(join(tmpdir(), 'canvas-config-'))))
  mkdirSync(join(project, 'screens'))
  process.env[projectVariable] = project
})

afterEach(() => {
  if (before === undefined) delete process.env[projectVariable]
  else process.env[projectVariable] = before
  rmSync(project, { recursive: true, force: true })
})

// The names of the plugins of the canvas, in their order. The plugins of the
// stack (React, Tailwind) have other names.
function canvasPlugins(config: UserConfig): string[] {
  const names: string[] = []
  const walk = (option: PluginOption) => {
    if (Array.isArray(option)) option.forEach(walk)
    else if (option && typeof option === 'object' && 'name' in option && option.name.startsWith('canvas-')) names.push(option.name)
  }
  walk(config.plugins ?? [])
  return names
}

describe('canvasConfig', () => {
  test('the editor server: the agent plugin before the requests plugin, and no plugin of the frames', async () => {
    const config = await canvasConfig('editor', 'serve')
    expect(canvasPlugins(config)).toEqual(['canvas-screens', 'canvas-agent', 'canvas-requests', 'canvas-tokens', 'canvas-pack', 'canvas-project'])
    expect(config.root).toBe(toolRoot)
    expect(config.base).toBeUndefined()
    expect(config.cacheDir).toBe(`${project}/.canvas/vite-editor`)
    expect(config.resolve?.dedupe).toEqual(['react', 'react-dom'])
    expect(config.server?.fs?.allow).toEqual(expect.arrayContaining([toolRoot, project]))
  })

  test('the frame server: the plugins of the frames, below /__frame/, with no file API', async () => {
    const config = await canvasConfig('frame', 'serve')
    expect(canvasPlugins(config)).toEqual([
      'canvas-source-location',
      'canvas-screens',
      'canvas-library',
      'canvas-pack',
      'canvas-project',
      'canvas-site',
    ])
    expect(config.base).toBe('/__frame/')
    expect(config.cacheDir).toBe(`${project}/.canvas/vite-frame`)
    expect(config.optimizeDeps?.entries).toContain(`${project}/screens/**/*.tsx`)
  })

  test('each server serves the folder sources of the pack, also outside the host, and not the root of the file system', async () => {
    mkdirSync(join(project, 'packs', 'kit', 'library'), { recursive: true })
    writeFileSync(join(project, 'packs', 'kit', 'pack.json'), JSON.stringify({ name: 'kit', sources: ['@acme/kit', '../shared/ui', '/opt/ui', '/'] }))
    writeFileSync(join(project, 'packs', 'kit', 'library', 'provider.tsx'), 'export function LibraryProvider() { return null }\n')
    const shared = project.replace(/\/[^/]+$/, '/shared/ui')
    for (const role of ['editor', 'frame'] as const) {
      const allow = (await canvasConfig(role, 'serve')).server?.fs?.allow
      expect(allow).toEqual(expect.arrayContaining([toolRoot, project, shared, '/opt/ui']))
      expect(allow).not.toContain('/')
    }
  })

  test('the build: the site into dist/ of the project, with relative addresses', async () => {
    const config = await canvasConfig('frame', 'build')
    expect(config.base).toBe('./')
    expect(config.build?.outDir).toBe(`${project}/dist`)
    expect(config.build?.emptyOutDir).toBe(true)
  })
})
