import { describe, expect, test } from 'vitest'
import { config } from '../canvas.config.ts'
import { agentSentence } from '../src/editor/requests/agent-sentence.ts'
import { agentCommand, agentCommands, codeOfTerminal, codePlaces, startResult } from './agent.ts'

const agent = { command: 'code', args: ['chat', '--mode', 'agent'] }

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

  test('the fixed sentence and the command of the config pass on each platform', () => {
    expect(config.agent).not.toBeNull()
    for (const platform of ['win32', 'darwin', 'linux']) {
      const command = agentCommand(config.agent, agentSentence, platform)
      expect(command.command).toBe(config.agent.command)
      expect(command.args.slice(0, -1)).toEqual([...config.agent.args])
      expect(command.args.at(-1)).toContain(agentSentence)
    }
  })

  test('the arguments of the config are not changed', () => {
    const args = ['chat']
    agentCommand({ command: 'code', args }, 'Do it.', 'win32')
    expect(args).toEqual(['chat'])
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
    expect(agentCommands({ command: 'cursor', args: [] }, {}, 'darwin', () => true)).toEqual(['cursor'])
    expect(agentCommands({ command: '/opt/code/bin/code', args: [] }, {}, 'linux', () => true)).toEqual(['/opt/code/bin/code'])
  })

  test('puts a path with a space in quotes for the shell of Windows', () => {
    const command = agentCommand({ command: 'C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd', args: ['chat'] }, 'Do it.', 'win32')
    expect(command.command).toBe('"C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd"')
    expect(() => agentCommand({ command: 'C:\\a&b\\code.cmd', args: [] }, 'Do it.', 'win32')).toThrow(/not safe/)
  })
})
