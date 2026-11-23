import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { describe, expect, test } from 'vitest'
import { agentAddress } from '../src/requests/api.ts'
import { createAgentHandler, type AgentDeps, type AgentProcess, type SpawnOptions } from './agent-plugin.ts'
import { agentOff, type AgentConfig } from './agent.ts'

const sentence = 'Apply the requests.'
const agent = { command: 'code', args: ['chat', '--mode', 'agent'] }

type Started = { command: string; args: string[]; options: SpawnOptions; unref: number }

// A stand-in for the start of a process: it records each start, and `then`
// says what the process does after the listeners are set.
function setup(
  then: (child: EventEmitter, command: string) => void,
  options: { agent?: AgentConfig; platform?: string; wait?: number; env?: Record<string, string>; exists?: (path: string) => boolean } = {},
) {
  const starts: Started[] = []
  const deps: AgentDeps = {
    root: () => '/project',
    agent: () => ('agent' in options ? options.agent! : agent),
    sentence,
    platform: options.platform ?? 'darwin',
    wait: options.wait ?? 5,
    env: () => options.env ?? {},
    exists: options.exists ?? (() => false),
    spawn(command, args, spawnOptions) {
      const started: Started = { command, args, options: spawnOptions, unref: 0 }
      starts.push(started)
      const child = Object.assign(new EventEmitter(), {
        unref() {
          started.unref += 1
        },
      })
      queueMicrotask(() => then(child, command))
      return child as unknown as AgentProcess
    },
  }
  return { starts, handle: createAgentHandler(deps) }
}

type Answer = { status: number; headers: Record<string, string>; body: string; next: boolean }

async function call(
  handle: ReturnType<typeof createAgentHandler>,
  method: string,
  url: string,
  options: { body?: string; headers?: Record<string, string> } = {},
): Promise<Answer> {
  const req = Object.assign(Readable.from(options.body === undefined ? [] : [Buffer.from(options.body)]), {
    method,
    url,
    headers: { host: 'localhost:5173', ...options.headers },
  })
  const answer: Answer = { status: 0, headers: {}, body: '', next: false }
  const res = {
    headersSent: false,
    writeHead(status: number, headers: Record<string, string>) {
      answer.status = status
      answer.headers = headers
      this.headersSent = true
    },
    end(text: string) {
      answer.body = text
    },
  }
  await handle(req as unknown as IncomingMessage, res as unknown as ServerResponse, () => {
    answer.next = true
  })
  return answer
}

const runs = (child: EventEmitter) => child.emit('spawn')

describe('createAgentHandler', () => {
  test('a different address goes to the next middleware, and nothing starts', async () => {
    const { handle, starts } = setup(runs)
    expect((await call(handle, 'POST', '/__canvas/requests/a')).next).toBe(true)
    expect((await call(handle, 'POST', `${agentAddress}/more`)).next).toBe(true)
    expect(starts).toEqual([])
  })

  test('a method other than POST is 405', async () => {
    const { handle, starts } = setup(runs)
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const answer = await call(handle, method, agentAddress)
      expect(answer.status).toBe(405)
      expect(answer.headers.Allow).toBe('POST')
    }
    expect(starts).toEqual([])
  })

  test('a call from a different origin is 403', async () => {
    const { handle, starts } = setup(runs)
    const answer = await call(handle, 'POST', agentAddress, { headers: { origin: 'http://other.example' } })
    expect(answer.status).toBe(403)
    expect(starts).toEqual([])
  })

  test('a process that runs after the wait: started, in the project root, detached, with no streams', async () => {
    const { handle, starts } = setup(runs)
    const answer = await call(handle, 'POST', agentAddress, { headers: { origin: 'http://localhost:5173' } })
    expect(answer.status).toBe(200)
    expect(answer.headers['Content-Type']).toContain('application/json')
    expect(JSON.parse(answer.body)).toEqual({ started: true })
    expect(starts).toEqual([
      {
        command: 'code',
        args: ['chat', '--mode', 'agent', sentence],
        options: { cwd: '/project', shell: false, detached: true, stdio: 'ignore', windowsHide: true },
        unref: 1,
      },
    ])
  })

  test('a process that ends with the code 0 started', async () => {
    const { handle } = setup((child) => {
      child.emit('spawn')
      child.emit('exit', 0)
    })
    expect(JSON.parse((await call(handle, 'POST', agentAddress)).body)).toEqual({ started: true })
  })

  test('no part of the call goes into the command', async () => {
    const { handle, starts } = setup(runs)
    await call(handle, 'POST', `${agentAddress}?prompt=rm&command=sh`, {
      body: JSON.stringify({ command: 'sh', args: ['-c', 'rm'], sentence: 'other' }),
      headers: { 'content-type': 'application/json', 'x-command': 'sh' },
    })
    expect(starts).toHaveLength(1)
    expect(starts[0].command).toBe('code')
    expect(starts[0].args).toEqual(['chat', '--mode', 'agent', sentence])
  })

  test('on Windows a shell starts the command with the quoted sentence', async () => {
    const { handle, starts } = setup(runs, { platform: 'win32' })
    await call(handle, 'POST', agentAddress)
    expect(starts[0].args.at(-1)).toBe(`"${sentence}"`)
    expect(starts[0].options.shell).toBe(true)
  })

  test('a command that is not found', async () => {
    const { handle } = setup((child) => {
      child.emit('error', Object.assign(new Error('spawn code ENOENT'), { code: 'ENOENT' }))
    })
    const answer = await call(handle, 'POST', agentAddress)
    expect(answer.status).toBe(200)
    expect(JSON.parse(answer.body)).toEqual({
      started: false,
      reason: 'the command "code" was not found, also not in the folder of VS Code; write its full path as `command` of `agent` in canvas.config.ts',
    })
  })

  test('a command that is not on the path is found in the folder of VS Code', async () => {
    const place = '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
    const { handle, starts } = setup(
      (child, command) => {
        if (command === 'code') child.emit('error', Object.assign(new Error('spawn code ENOENT'), { code: 'ENOENT' }))
        else child.emit('spawn')
      },
      { exists: (path) => path === place },
    )
    const answer = await call(handle, 'POST', agentAddress)
    expect(JSON.parse(answer.body)).toEqual({ started: true })
    expect(starts.map((start) => start.command)).toEqual(['code', place])
    expect(starts[1].args.at(-1)).toBe(sentence)
  })

  test('a command that ends with an error code within the wait', async () => {
    const { handle } = setup((child) => {
      child.emit('spawn')
      child.emit('exit', 1)
    })
    expect(JSON.parse((await call(handle, 'POST', agentAddress)).body)).toEqual({
      started: false,
      reason: 'the command "code" ended with the code 1',
    })
  })

  test('with no command in the config, nothing starts', async () => {
    const { handle, starts } = setup(runs, { agent: null })
    const answer = await call(handle, 'POST', agentAddress)
    expect(answer.status).toBe(200)
    expect(JSON.parse(answer.body)).toEqual({ started: false, reason: agentOff })
    expect(starts).toEqual([])
  })

  test('a start that throws is an answer with its message', async () => {
    const handle = createAgentHandler({
      root: () => '/project',
      agent: () => agent,
      sentence,
      platform: 'darwin',
      spawn() {
        throw new Error('no process')
      },
    })
    expect(JSON.parse((await call(handle, 'POST', agentAddress)).body)).toEqual({ started: false, reason: 'no process' })
  })
})
