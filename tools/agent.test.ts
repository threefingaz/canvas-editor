import { describe, expect, test } from 'vitest'
import { config } from '../canvas.config.ts'
import { agentSentence } from '../src/editor/requests/agent-sentence.ts'
import { agentCommand, startResult } from './agent.ts'

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
