import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, posix } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { tokensSentence } from '../src/frame/library-setup.ts'
import { formatTokens, type Token } from '../src/tokens/format.ts'
import { applyInit, diskOf, initPlan } from './init.ts'
import { slashes, toolRoot } from './project.ts'
import { nextStep, readStatus, statusText, type Status } from './status.ts'

const folders: string[] = []

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

// A host with a library, set up by `canvas init`.
function initHost(): { host: string; project: string } {
  const host = slashes(mkdtempSync(join(tmpdir(), 'canvas-status-')))
  folders.push(host)
  write(join(host, 'package.json'), JSON.stringify({ name: 'host', dependencies: { '@acme/ui': '1', react: '19' } }))
  write(join(host, 'node_modules/@acme/ui/package.json'), JSON.stringify({ name: '@acme/ui', peerDependencies: { react: '*' } }))
  const project = posix.join(host, 'canvas')
  applyInit(initPlan({ disk: diskOf(), tool: toolRoot, host, project, library: null }))
  return { host, project }
}

const screen = (title: string) => `import { Button } from '@acme/ui'

export const meta = { title: '${title}', width: 1440 }

export default function Screen() {
  return <div><Button>Go</Button></div>
}
`

const token: Token = { id: 'c.primary', group: 'color', name: 'primary', value: '#000000', code: 'primary' }

describe('readStatus', () => {
  test('a host after init: the level connected, the screens and the findings, the guide up to date', async () => {
    const { host, project } = initHost()
    write(join(project, 'screens/start/welcome.tsx'), screen('Welcome'))
    const status = await readStatus(project, toolRoot)
    expect(status).toMatchObject({
      project,
      host,
      library: { name: 'acme', sources: ['@acme/ui'], folder: 'packs/acme' },
      packError: null,
      level: 'connected',
      provider: { path: 'packs/acme/library/provider.tsx', exists: true },
      tokens: { kind: 'ok', count: 0 },
      skill: null,
      screens: { count: 1, flows: 1 },
      check: { findings: 1, kinds: { 'not-library': 1 } },
      guide: { changes: 0 },
    })
    expect(status.guide?.version).toBe(status.tool)
    const text = statusText(status)
    expect(text).toContain('Library: @acme/ui, the pack packs/acme (level connected)')
    expect(text).toContain('Tokens: none yet')
    expect(text).toContain('Screens: 1 screen in 1 flow')
    expect(text).toContain('Check: 1 finding (not-library 1)')
    expect(text).toContain('Guide: written by canvas-editor')
    expect(text).toContain(tokensSentence)

    // Tokens, a library skill, and an older guide.
    write(join(project, 'tokens.json'), formatTokens([token]))
    write(join(project, 'packs/acme/skills/canvas-library-acme/SKILL.md'), '---\nname: canvas-library-acme\ndescription: x\n---\n')
    write(join(project, 'guide/requests.md'), 'older\n')
    const ready = await readStatus(project, toolRoot)
    expect(ready).toMatchObject({ level: 'ready', skill: 'packs/acme/skills/canvas-library-acme/SKILL.md', guide: { changes: 1 } })
    const readyText = statusText(ready)
    expect(readyText).toContain('Tokens: 1 (color 1, spacing 0')
    expect(readyText).toContain('canvas sync writes 1 file')
    expect(readyText).toContain('Next: the setup is done.')
  })

  test('a pack error, a token file that is not valid, a config that is not valid, and a guide that cannot be planned', async () => {
    const { project } = initHost()
    write(join(project, 'packs/other/pack.json'), JSON.stringify({ name: 'other', sources: ['other'] }))
    write(join(project, 'tokens.json'), '{')
    write(join(project, 'canvas.config.ts'), "export const config = { widths: 'wide' }\n")
    const status = await readStatus(project, toolRoot)
    expect(status).toMatchObject({ level: 'none', tokens: { kind: 'error' } })
    expect(status.packError).toContain('more than one library pack')
    expect(status.settingsError).not.toBeNull()
    const text = statusText(status)
    expect(text).toContain('Library: the pack is not valid: ')
    expect(text).toContain('Tokens: tokens.json is not valid: ')
    expect(text).toContain('Config: canvas.config.ts is not valid: ')
    // A copy of the tool with no guide: the plan of sync throws, and the status says so.
    expect(statusText({ ...status, guide: { version: '1', changes: null, error: 'The AGENTS.md of the tool is missing.' } })).toContain(
      'canvas sync cannot run: The AGENTS.md of the tool is missing.',
    )
  })

  test('the tool itself: standalone, with the guide of the tool', async () => {
    const status = await readStatus(toolRoot, toolRoot)
    expect(status.host).toBeNull()
    expect(status.guide).toBeNull()
    expect(statusText(status)).toContain('(standalone)')
  })
})

describe('statusText and nextStep', () => {
  const base: Status = {
    project: '/p',
    host: null,
    library: null,
    packError: null,
    level: 'none',
    provider: null,
    tokens: { kind: 'missing' },
    skill: null,
    screens: { count: 0, flows: 0 },
    check: { findings: 0, kinds: {} },
    agent: { setting: 'clipboard', way: { kind: 'clipboard' } },
    tool: '1.0.0',
    guide: null,
    settingsError: null,
  }

  test('no library: the next step is init', () => {
    const text = statusText(base)
    expect(text).toContain('Library: none is connected')
    expect(text).toContain('Tokens: no tokens.json')
    expect(text).toContain('Screens: 0 screens in 0 flows')
    expect(text).toContain('Check: no finding')
    expect(text).toContain("Agent: the clipboard: Copy for the agent copies the sentence (agent 'clipboard')")
    expect(text).toContain('Next: Connect a library: canvas init')
  })

  test('the order of the next steps', () => {
    const pack = { library: { name: 'a', sources: ['a'], folder: 'packs/a' }, provider: { path: 'packs/a/library/provider.tsx', exists: true } }
    expect(nextStep({ ...base, packError: 'two packs' })).toContain('Fix the pack')
    expect(nextStep({ ...base, ...pack, level: 'ready', provider: { path: 'x', exists: false } })).toContain('Write the provider x')
    expect(nextStep({ ...base, ...pack, level: 'ready' })).toContain('canvas tokens')
    expect(nextStep({ ...base, ...pack, level: 'ready', tokens: { kind: 'error', message: 'bad' } })).toContain('canvas tokens')
    expect(nextStep({ ...base, ...pack, level: 'connected', tokens: { kind: 'ok', groups: {}, count: 0 } })).toContain('level 2')
    expect(nextStep({ ...base, ...pack, level: 'ready', tokens: { kind: 'ok', groups: { color: 1 }, count: 1 } })).toContain('library skill')
    expect(nextStep({ ...base, ...pack, level: 'ready', tokens: { kind: 'ok', groups: { color: 1 }, count: 1 }, skill: 's' })).toBeNull()
  })

  test('the agent command, and a guide with no copy or no version line', () => {
    const line = { command: 'code', args: ['chat'] }
    const text = statusText({ ...base, host: '/h', agent: { setting: line, way: { kind: 'command', line, preset: null } }, guide: { version: null, changes: null, error: null } })
    expect(text).toContain('Project: /p, in the host /h')
    expect(text).toContain('Agent: the command code chat (agent { command, args })')
    expect(text).toContain('Guide: the copy has no version line; no copy: run canvas init')
  })

  test('agent auto names the way and says where it is decided', () => {
    const way = { kind: 'command' as const, line: { command: 'code', args: ['chat'] }, preset: 'vscode' as const }
    expect(statusText({ ...base, agent: { setting: 'auto', way } })).toContain(
      "Agent: the preset vscode, code chat (agent 'auto', in this terminal; the dev server decides it in its own)",
    )
  })
})
