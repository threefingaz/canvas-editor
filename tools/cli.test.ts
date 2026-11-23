import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { commandOf, commands, dispatchOf, scriptOf, usage, type Command, type DispatchDeps } from './cli.ts'
import { serverOptions } from './dev.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

function command(name: Command['name'], fields: Partial<Command> = {}): ReturnType<typeof commandOf> {
  return { kind: 'command', command: { name, project: null, port: null, library: null, args: [], ...fields } }
}

describe('commandOf', () => {
  test('each command with no argument', () => {
    for (const name of commands) expect(commandOf([name])).toEqual(command(name))
  })

  test('no command, and help, give the usage', () => {
    expect(commandOf([])).toEqual({ kind: 'help' })
    expect(commandOf(['help'])).toEqual({ kind: 'help' })
    expect(commandOf(['--help'])).toEqual({ kind: 'help' })
    expect(commandOf(['-h'])).toEqual({ kind: 'help' })
  })

  test('an unknown command is an error that lists the commands', () => {
    const parsed = commandOf(['serve'])
    expect(parsed.kind).toBe('error')
    if (parsed.kind === 'error') expect(parsed.message).toContain('dev, build, preview, check, tokens, status, init, sync, agents, export')
  })

  test('--project, as two arguments and with =', () => {
    expect(commandOf(['dev', '--project', 'canvas'])).toEqual(command('dev', { project: 'canvas' }))
    expect(commandOf(['check', '--project=../app/canvas', 'a/b'])).toEqual(command('check', { project: '../app/canvas', args: ['a/b'] }))
    expect(commandOf(['tokens', '--project']).kind).toBe('error')
    expect(commandOf(['tokens', '--project=']).kind).toBe('error')
    for (const name of ['dev', 'build', 'preview', 'check', 'tokens', 'status', 'init', 'sync', 'agents'] as const) {
      expect(commandOf([name, '--project', 'p'])).toEqual(command(name, { project: 'p' }))
    }
    // `export` works on the tool, not on a project.
    expect(commandOf(['export', '--project', 'p', 'out']).kind).toBe('error')
  })

  test('--library for init only', () => {
    expect(commandOf(['init', '--library', '@mui/material@^9'])).toEqual(command('init', { library: '@mui/material@^9' }))
    expect(commandOf(['init', '--library=./src/ui', '--project', 'canvas'])).toEqual(command('init', { library: './src/ui', project: 'canvas' }))
    expect(commandOf(['init', '--library']).kind).toBe('error')
    expect(commandOf(['sync', '--library', 'x']).kind).toBe('error')
    expect(commandOf(['init', 'x']).kind).toBe('error')
  })

  test('--port for dev and preview only, a number from 1 to 65535', () => {
    expect(commandOf(['dev', '--port', '5181'])).toEqual(command('dev', { port: 5181 }))
    expect(commandOf(['preview', '--port=4173'])).toEqual(command('preview', { port: 4173 }))
    for (const value of ['0', '65536', 'abc', '51.8', '-1']) expect(commandOf(['dev', '--port', value]).kind).toBe('error')
    expect(commandOf(['dev', '--port']).kind).toBe('error')
    expect(commandOf(['build', '--port', '5181']).kind).toBe('error')
    expect(commandOf(['check', '--port', '5181']).kind).toBe('error')
  })

  test('the arguments after --, and the same arguments with no --', () => {
    const expected = command('check', { args: ['onboarding/welcome', 'screens/onboarding/workspace.tsx'] })
    expect(commandOf(['check', 'onboarding/welcome', 'screens/onboarding/workspace.tsx'])).toEqual(expected)
    expect(commandOf(['check', '--', 'onboarding/welcome', 'screens/onboarding/workspace.tsx'])).toEqual(expected)
    // After -- an argument that starts with -- is an argument, not an option.
    expect(commandOf(['export', '--', '--port'])).toEqual(command('export', { args: ['--port'] }))
    expect(commandOf(['export', '--port', '1', '--', 'x']).kind).toBe('error')
    expect(commandOf(['check', '--project', 'p', '--', 'a'])).toEqual(command('check', { project: 'p', args: ['a'] }))
  })

  test('an unknown option, and arguments for a command that takes none, are errors', () => {
    expect(commandOf(['dev', '--strictPort']).kind).toBe('error')
    expect(commandOf(['dev', '--host']).kind).toBe('error')
    expect(commandOf(['build', 'dist']).kind).toBe('error')
    expect(commandOf(['tokens', '--', 'x']).kind).toBe('error')
    expect(commandOf(['agents', 'x']).kind).toBe('error')
  })
})

describe('the scripts of the commands', () => {
  test('each script of a command exists', () => {
    for (const name of commands) {
      const script = scriptOf(name)
      if (script !== null) expect(existsSync(join(root, 'tools', script))).toBe(true)
    }
  })

  test('the usage names each command', () => {
    for (const name of commands) expect(usage).toMatch(new RegExp(`^  ${name}\\b`, 'm'))
  })
})

describe('dispatchOf', () => {
  const tool = '/w/app/node_modules/canvas-editor'
  const clone = '/w/canvas-editor'
  const named = (name: Command['name'], fields: Partial<Command> = {}): Command => ({
    name,
    project: null,
    port: null,
    library: null,
    args: [],
    ...fields,
  })
  // A host `/w/app` with `canvas/` set up, and the home folder `/w`.
  const deps = (fields: Partial<DispatchDeps> = {}): DispatchDeps => ({
    env: {},
    cwd: '/w/app',
    tool,
    home: '/w',
    exists: (path) => ['/w/app/package.json', '/w/app/canvas/canvas.config.ts', '/w/.git'].includes(path),
    isFolder: (path) => path === '/w/app/canvas',
    ...fields,
  })

  test('a command finds the project of the host', () => {
    for (const name of ['dev', 'build', 'preview', 'check', 'tokens', 'status', 'sync', 'agents'] as const) {
      expect(dispatchOf(named(name), deps())).toEqual({ kind: 'run', project: '/w/app/canvas' })
    }
  })

  test('init takes canvas/ of the host, also before it exists', () => {
    expect(dispatchOf(named('init'), deps({ exists: (path) => path === '/w/app/package.json' }))).toEqual({
      kind: 'run',
      project: '/w/app/canvas',
    })
  })

  test('a lookup that found no project is a refusal, but not for export', () => {
    const none = deps({ cwd: '/w/other', exists: () => false })
    expect(dispatchOf(named('dev'), none)).toMatchObject({ kind: 'fail', message: expect.stringContaining('No canvas project was found') })
    expect(dispatchOf(named('export'), none)).toEqual({ kind: 'run', project: tool })
    // A clone run from a host before init finds no project there either.
    expect(dispatchOf(named('status'), deps({ tool: clone, exists: () => false }))).toMatchObject({ kind: 'fail' })
    // In the folder of the clone, the clone is the project.
    expect(dispatchOf(named('status'), deps({ tool: clone, cwd: clone, exists: () => false }))).toEqual({ kind: 'run', project: clone })
  })

  test('a folder that the user named must be a folder; the lookup is not checked then', () => {
    expect(dispatchOf(named('dev', { project: 'canvas' }), deps())).toEqual({ kind: 'run', project: '/w/app/canvas' })
    expect(dispatchOf(named('dev', { project: 'none' }), deps())).toMatchObject({
      kind: 'fail',
      message: 'The project folder /w/app/none does not exist or is not a folder.',
    })
    expect(dispatchOf(named('tokens'), deps({ env: { CANVAS_PROJECT: '/w/x' } }))).toMatchObject({ kind: 'fail' })
    // The variable names the tool: no lookup, thus no refusal of the lookup.
    expect(dispatchOf(named('tokens'), deps({ tool: clone, env: { CANVAS_PROJECT: clone }, isFolder: () => true }))).toEqual({
      kind: 'run',
      project: clone,
    })
  })

  test('init, sync and agents refuse a host that is the home folder; dev does not write there', () => {
    const home = deps({ cwd: '/w/loose', exists: (path) => ['/w/.git', '/w/loose/canvas/canvas.config.ts'].includes(path) })
    for (const name of ['init', 'sync', 'agents'] as const) {
      expect(dispatchOf(named(name), home)).toMatchObject({ kind: 'fail', message: expect.stringContaining('The host would be /w') })
    }
    expect(dispatchOf(named('dev'), home)).toEqual({ kind: 'run', project: '/w/loose/canvas' })
  })
})

describe('the npm scripts and the bin', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

  test('each npm script of a command runs it through bin/canvas.js, with no flag for the types', () => {
    expect(pkg.bin).toEqual({ canvas: 'bin/canvas.js' })
    for (const name of commands) expect(pkg.scripts[name]).toBe(`node bin/canvas.js ${name}`)
    expect(JSON.stringify(pkg.scripts)).not.toContain('strip-types')
  })

  test('bin/canvas.js runs the command: --help gives the usage', () => {
    const text = readFileSync(join(root, 'bin', 'canvas.js'), 'utf8')
    expect(text.startsWith('#!/usr/bin/env node\n')).toBe(true)
    const result = spawnSync(process.execPath, [join(root, 'bin', 'canvas.js'), '--help'], { encoding: 'utf8', timeout: 60_000 })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(usage.trim())
  })
})

describe('serverOptions', () => {
  test('a port is strict; no port leaves the default of Vite', () => {
    expect(serverOptions({ port: 5181 })).toEqual({ port: 5181, strictPort: true })
    expect(serverOptions({ port: null })).toEqual({})
  })
})
