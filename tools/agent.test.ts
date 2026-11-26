import { describe, expect, test } from 'vitest'
import { config } from '../canvas.config.ts'
import { agentSentence, guidePath } from '../src/editor/requests/agent-sentence.ts'
import { agentCommand, agentCommands, agentOf, choiceOf, vscodeLine, codeOfTerminal, codePlaces, failedReason, inCodeTerminal, isPreset, settingText, startFailure, startResult, wayText } from './agent.ts'

const agent = { command: 'code', args: ['chat', '--mode', 'agent'] }

const vscode = { kind: 'command', line: vscodeLine, preset: 'vscode' } as const
const askpass = '/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/git/dist/askpass-main.js'

describe('agentOf', () => {
  test("'auto' takes the preset vscode in a terminal of VS Code", () => {
    expect(agentOf('auto', { TERM_PROGRAM: 'vscode' })).toEqual(vscode)
    expect(agentOf('auto', { VSCODE_GIT_ASKPASS_MAIN: askpass })).toEqual(vscode)
  })

  test("'auto' takes the clipboard in each other terminal", () => {
    expect(agentOf('auto', {})).toEqual({ kind: 'clipboard' })
    expect(agentOf('auto', { TERM_PROGRAM: 'Apple_Terminal', VSCODE_GIT_ASKPASS_MAIN: '' })).toEqual({ kind: 'clipboard' })
  })

  test("'clipboard' is the clipboard in each terminal", () => {
    for (const env of [{}, { TERM_PROGRAM: 'vscode' }]) {
      expect(agentOf('clipboard', env)).toEqual({ kind: 'clipboard' })
    }
  })

  test('a preset is its command line in each terminal', () => {
    expect(agentOf('vscode', {})).toEqual(vscode)
    expect(vscodeLine).toEqual({ command: 'code', args: ['chat', '--mode', 'agent', '--reuse-window'] })
  })

  test('a command of the user is used as it is, with no preset', () => {
    expect(agentOf(agent, { TERM_PROGRAM: 'vscode' })).toEqual({ kind: 'command', line: agent, preset: null })
  })

  test('an object equal to a preset is a command of the user, with no preset', () => {
    expect(agentOf({ ...vscodeLine }, {})).toEqual({ kind: 'command', line: vscodeLine, preset: null })
  })

  // The user can write each value in `canvas.config.ts` (a full path at work),
  // thus no test asserts the value itself: only that the tool takes it.
  test('the value of the config gives the way of its form', () => {
    const choice = choiceOf(config.agent)
    const way = agentOf(choice, {})
    if (typeof choice === 'object') expect(way).toEqual({ kind: 'command', line: choice, preset: null })
    else expect(way).toEqual(choice === 'vscode' ? vscode : { kind: 'clipboard' })
  })

  test('the names of the presets', () => {
    expect(isPreset('vscode')).toBe(true)
    for (const value of ['auto', 'clipboard', 'toString', 'code', 3, null]) expect(isPreset(value)).toBe(false)
    expect(inCodeTerminal({})).toBe(false)
  })

  test('the texts of the way and of the setting', () => {
    expect(wayText({ kind: 'clipboard' })).toBe('the clipboard: Copy for the agent copies the sentence')
    expect(wayText(vscode)).toBe('the preset vscode, code chat --mode agent --reuse-window')
    expect(wayText({ kind: 'command', line: agent, preset: null })).toBe('the command code chat --mode agent')
    expect(['auto', 'clipboard', 'vscode', agent].map((setting) => settingText(setting as never))).toEqual([
      "'auto'",
      "'clipboard'",
      "'vscode'",
      '{ command, args }',
    ])
  })
})

describe('failedReason', () => {
  const notFound = 'the command "code" was not found'

  test('with a preset, the reason names the preset and the next step', () => {
    expect(failedReason(vscode, notFound)).toBe(
      "the preset vscode: the command \"code\" was not found, also not in the folder of VS Code; set `agent` in canvas.config.ts to `{ command, args }` with the full path of the command, or to 'clipboard'",
    )
    expect(failedReason(vscode, 'the command "code" ended with the code 1')).toBe('the preset vscode: the command "code" ended with the code 1')
  })

  test('with a command of the user, the reason names no code editor', () => {
    const own = { kind: 'command', line: { command: 'code', args: [] }, preset: null } as const
    expect(failedReason(own, notFound)).toBe('the command "code" was not found; write its full path as `command` of `agent` in canvas.config.ts')
    expect(failedReason(own, notFound)).not.toContain('VS Code')
    expect(failedReason(own, 'the command "code" was stopped')).toBe('the command "code" was stopped')
  })
})

describe('agentCommand', () => {
  test('with no shell, the sentence is the last argument as it is', () => {
    expect(agentCommand(agent, 'Do "this" & that', 'darwin')).toEqual({
      command: 'code',
      args: ['chat', '--mode', 'agent', 'Do "this" & that'],
      shell: false,
    })
    expect(agentCommand(agent, 'Do it.', 'linux').shell).toBe(false)
  })

  test('on Windows a shell starts the command, and the sentence is one quoted argument', () => {
    expect(agentCommand(agent, 'Do it now.', 'win32')).toEqual({
      command: 'code',
      args: ['chat', '--mode', 'agent', '"Do it now."'],
      shell: true,
    })
  })

  test('on Windows a sentence with a character of the shell is refused', () => {
    for (const character of ['"', '%', '&', '|', '<', '>', '^', '`', '$', '!', '\n', '\r']) {
      expect(() => agentCommand(agent, `a${character}b`, 'win32'), JSON.stringify(character)).toThrow('not safe')
    }
  })

  test('the fixed sentence and the command of the preset pass on each platform', () => {
    const line = vscodeLine
    for (const platform of ['win32', 'darwin', 'linux']) {
      const command = agentCommand(line, agentSentence(guidePath), platform)
      expect(command.command).toBe(line.command)
      expect(command.args.slice(0, -1)).toEqual([...line.args])
      expect(command.args.at(-1)).toContain(agentSentence(guidePath))
    }
  })

  test('the arguments of the config are not changed', () => {
    const args = ['chat']
    agentCommand({ command: 'code', args }, 'Do it.', 'win32')
    expect(args).toEqual(['chat'])
  })
})

describe('startFailure', () => {
  const notFound = (command: string) => ({ command, reason: `the command "${command}" was not found` })

  test('a place that was there and failed wins over the places that were not found', () => {
    const terminal = { command: '/Apps/code', reason: 'the command "/Apps/code" ended with the code 1' }
    expect(startFailure([terminal, notFound('code'), notFound('/usual/code')], 'code')).toBe(terminal.reason)
  })

  test('with no such place, the command of the setting, else the first place', () => {
    expect(startFailure([notFound('/Apps/code'), notFound('code')], 'code')).toBe(notFound('code').reason)
    expect(startFailure([notFound('/a'), notFound('/b')], 'code')).toBe(notFound('/a').reason)
    expect(startFailure([], 'code')).toBeNull()
  })
})

describe('startResult', () => {
  test('a process that runs, or that ended with the code 0, started', () => {
    expect(startResult({ kind: 'running' }, 'code')).toEqual({ started: true })
    expect(startResult({ kind: 'exit', code: 0 }, 'code')).toEqual({ started: true })
  })

  test('a command that the system does not find', () => {
    expect(startResult({ kind: 'error', code: 'ENOENT', message: 'spawn code ENOENT' }, 'code')).toEqual({
      started: false,
      reason: 'the command "code" was not found',
    })
  })

  test('a different error of the start has its message', () => {
    expect(startResult({ kind: 'error', code: 'EACCES', message: 'spawn code EACCES' }, 'code')).toEqual({
      started: false,
      reason: 'the command "code" did not start: spawn code EACCES',
    })
  })

  test('an error code, or a stop by a signal', () => {
    expect(startResult({ kind: 'exit', code: 1 }, 'code')).toEqual({
      started: false,
      reason: 'the command "code" ended with the code 1',
    })
    expect(startResult({ kind: 'exit', code: null }, 'code')).toEqual({
      started: false,
      reason: 'the command "code" was stopped',
    })
  })
})

describe('the command line of VS Code off the path', () => {
  const mac = '/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/git/dist/askpass-main.js'
  const win = 'C:\\Users\\a\\AppData\\Local\\Programs\\Microsoft VS Code\\resources\\app\\extensions\\git\\dist\\askpass-main.js'
  const code = { command: 'code', args: ['chat'] }

  test('finds the command of the VS Code that owns the terminal', () => {
    expect(codeOfTerminal(mac, 'darwin')).toBe('/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code')
    expect(codeOfTerminal(win, 'win32')).toBe('C:\\Users\\a\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd')
    expect(codeOfTerminal('/usr/share/code/resources/app/extensions/git/dist/askpass-main.js', 'linux')).toBe('/usr/share/code/bin/code')
    expect(codeOfTerminal(undefined, 'darwin')).toBeNull()
    expect(codeOfTerminal('/somewhere/askpass.sh', 'darwin')).toBeNull()
  })

  test('gives the usual places of a platform', () => {
    expect(codePlaces({ HOME: '/Users/a' }, 'darwin')).toEqual([
      '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      '/Users/a/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
    ])
    expect(codePlaces({ LOCALAPPDATA: 'C:\\L' }, 'win32')).toEqual(['C:\\L\\Programs\\Microsoft VS Code\\bin\\code.cmd'])
  })

  test('tries the VS Code of the terminal, then the path, then the usual places that exist', () => {
    const env = { VSCODE_GIT_ASKPASS_MAIN: '/Apps/Code.app/Contents/Resources/app/extensions/git/dist/askpass-main.js', HOME: '/Users/a' }
    const usual = '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
    expect(agentCommands(code, env, 'darwin', () => true)).toEqual(['/Apps/Code.app/Contents/Resources/app/bin/code', 'code', usual, `/Users/a${usual}`])
    expect(agentCommands(code, env, 'darwin', (path) => path === usual)).toEqual(['code', usual])
    expect(agentCommands(code, {}, 'linux', () => false)).toEqual(['code'])
  })

  test('tries a different command, and a command with a path, as it is', () => {
    expect(agentCommands({ command: 'my-agent', args: [] }, {}, 'darwin', () => true)).toEqual(['my-agent'])
    expect(agentCommands({ command: '/opt/code/bin/code', args: [] }, {}, 'linux', () => true)).toEqual(['/opt/code/bin/code'])
  })

  test('puts a path with a space in quotes for the shell of Windows', () => {
    const command = agentCommand({ command: 'C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd', args: ['chat'] }, 'Do it.', 'win32')
    expect(command.command).toBe('"C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd"')
    expect(() => agentCommand({ command: 'C:\\a&b\\code.cmd', args: [] }, 'Do it.', 'win32')).toThrow(/not safe/)
  })

  test('checks and quotes each argument of the config for the shell of Windows', () => {
    const command = agentCommand({ command: 'agent', args: ['--profile', 'My Work'] }, 'Do it.', 'win32')
    expect(command.args).toEqual(['--profile', '"My Work"', '"Do it."'])
    for (const arg of ['a&b', 'a|b', '%PATH%', 'a"b']) {
      expect(() => agentCommand({ command: 'agent', args: [arg] }, 'Do it.', 'win32'), arg).toThrow(/not safe/)
    }
    // A gap of a script (`,` `;` `=`), a tab, a group and an empty argument
    // are one quoted word; a backslash at the end is doubled in the quotes.
    expect(agentCommand({ command: 'agent', args: ['a,b', 'k=v', 'a;b', 'a\tb', '(x)', '', 'C:\\dir\\', 'C:\\my dir\\'] }, 'Do it.', 'win32').args).toEqual([
      '"a,b"',
      '"k=v"',
      '"a;b"',
      '"a\tb"',
      '"(x)"',
      '""',
      'C:\\dir\\',
      '"C:\\my dir\\\\"',
      '"Do it."',
    ])
    // With no shell the arguments are as they are.
    expect(agentCommand({ command: 'agent', args: ['a&b'] }, 'Do it.', 'darwin').args).toEqual(['a&b', 'Do it.'])
  })
})
