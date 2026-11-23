import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { config } from '../canvas.config.ts'
import { projectDefaults, readProjectSettings, settingsOf, toolSettings } from './project-config.ts'
import { slashes, toolRoot } from './project.ts'

const file = '/work/app/canvas/canvas.config.ts'

describe('settingsOf', () => {
  test('the tool settings are those of the config of the tool', () => {
    expect(toolSettings).toEqual({ widths: config.widths, agent: config.agent })
  })

  test('a project has the widths of the tool and agent auto by default', () => {
    expect(projectDefaults).toEqual({ widths: config.widths, agent: 'auto' })
  })

  test('takes widths and agent of the export config', () => {
    const agent = { command: 'my-agent', args: ['--prompt'] }
    expect(settingsOf({ config: { widths: [1280, 375], agent } }, file)).toEqual({ widths: [1280, 375], agent })
    for (const setting of ['auto', 'clipboard', 'vscode']) {
      expect(settingsOf({ config: { agent: setting } }, file)).toEqual({ widths: config.widths, agent: setting })
    }
    // null of an older config is the clipboard.
    expect(settingsOf({ config: { agent: null } }, file)).toEqual({ widths: config.widths, agent: 'clipboard' })
  })

  test('takes the default export too, and the default of each field that is not there', () => {
    expect(settingsOf({ default: { widths: [800] } }, file)).toEqual({ widths: [800], agent: 'auto' })
    expect(settingsOf({ config: {} }, file)).toEqual(projectDefaults)
  })

  test('the other fields of a config are left alone', () => {
    expect(settingsOf({ config: { screens: 'other', tokens: 'x.json', widths: [600] } }, file)).toEqual({ widths: [600], agent: 'auto' })
  })

  test('a field that is not valid throws with the file', () => {
    expect(() => settingsOf({}, file)).toThrow(`${file}: the file has no export \`config\``)
    expect(() => settingsOf({ config: 3 }, file)).toThrow('`config` must be an object')
    for (const widths of [[], ['390'], [0], [1.5], 390]) {
      expect(() => settingsOf({ config: { widths } }, file)).toThrow('`widths` must be a list')
    }
    for (const agent of ['code', 'toString', '', 3, { command: '', args: [] }, { command: 'code' }, { command: 'code', args: [1] }]) {
      expect(() => settingsOf({ config: { agent } }, file)).toThrow("`agent` must be 'auto', 'clipboard'")
    }
  })
})

describe('readProjectSettings', () => {
  test('the project of the tool gets the tool settings, and a project with no config the defaults', async () => {
    expect(await readProjectSettings(toolRoot)).toBe(toolSettings)
    const folder = slashes(mkdtempSync(join(tmpdir(), 'canvas-project-')))
    try {
      expect(await readProjectSettings(folder)).toBe(projectDefaults)
    } finally {
      rmSync(folder, { recursive: true, force: true })
    }
  })

  test('loads the config of a project, also with types', async () => {
    const folder = slashes(mkdtempSync(join(tmpdir(), 'canvas-project-')))
    try {
      const text = "type Agent = { command: string; args: string[] } | null\nconst agent: Agent = null\nexport const config = { widths: [1280, 375], agent }\n"
      writeFileSync(join(folder, 'canvas.config.ts'), text)
      expect(await readProjectSettings(folder)).toEqual({ widths: [1280, 375], agent: 'clipboard' })
    } finally {
      rmSync(folder, { recursive: true, force: true })
    }
  })

  test('the config of an older version, with its own type and the command of the agent, works as before', async () => {
    const folder = slashes(mkdtempSync(join(tmpdir(), 'canvas-project-')))
    try {
      const text = [
        'export type CanvasConfig = { widths: readonly number[]; screens: string; tokens: string; work: string; agent: { command: string; args: readonly string[] } | null }',
        "export const config = { widths: [1440, 1024, 390], screens: 'screens', tokens: 'tokens.json', work: '.canvas',",
        "  agent: { command: '/opt/vs code/bin/code', args: ['chat', '--mode', 'agent', '--reuse-window'] } } as const satisfies CanvasConfig",
      ].join('\n')
      writeFileSync(join(folder, 'canvas.config.ts'), text)
      expect((await readProjectSettings(folder)).agent).toEqual({ command: '/opt/vs code/bin/code', args: ['chat', '--mode', 'agent', '--reuse-window'] })
    } finally {
      rmSync(folder, { recursive: true, force: true })
    }
  })

  test('the config of the template of canvas init has agent auto', async () => {
    const folder = slashes(mkdtempSync(join(tmpdir(), 'canvas-project-')))
    try {
      copyFileSync(join(toolRoot, 'tools/templates/canvas.config.ts.template'), join(folder, 'canvas.config.ts'))
      expect(await readProjectSettings(folder)).toEqual({ widths: config.widths, agent: 'auto' })
    } finally {
      rmSync(folder, { recursive: true, force: true })
    }
  })
})
