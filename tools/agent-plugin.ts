// Development only: "Send to the agent". The setting `agent` of the config
// gives the way (`agentOf` in `agent.ts`), once, when the server starts:
// the clipboard, or a command that opens the chat of the agent with the fixed
// sentence, thus the user neither types nor pastes it.
//
// `GET /__canvas/agent` answers the way, for the toolbar of the editor:
// `{ "way": "clipboard" }` or `{ "way": "command", "preset": "vscode" | null }`.
//
// `POST /__canvas/agent` starts the command on this machine; nothing goes to
// a remote server. The answer is JSON with the status 200:
// `{ "started": true }`, or `{ "started": false, "reason": "<short text>" }`
// when the way is the clipboard, the command is not found, or it ends with an
// error code within a short time. The editor then copies the sentence for the
// user.
//
// No part of the call goes into the command: the handler does not read the
// body, the query or a header for it. The command and the sentence are fixed
// in the code, thus a page cannot make the server run a different thing.

import { spawn as spawnProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { ServerResponse } from 'node:http'
import { normalizePath, type Plugin } from 'vite'
import { agentSentence } from '../src/editor/requests/agent-sentence.ts'
import { agentAddress, type AgentAnswer, type AgentWayAnswer } from '../src/requests/api.ts'
import { messageOf } from '../src/tokens/format.ts'
import { agentCommand, agentCommands, agentOf, failedReason, noCommand, startFailure, startResult, type AgentLine, type AgentChoice, type AgentWay, type Env, type StartEvent } from './agent.ts'
import { guarded, sendText, type Handler } from './http.ts'
import { otherOriginText, sameOrigin } from './requests.ts'

// How long the handler waits for an error code of the command, in ms. The
// command of a code editor hands the prompt to the open window and ends, or
// stays; a command that fails does so at once.
export const startWait = 1500

// The part of a child process that the handler reads.
export type AgentProcess = {
  once(event: 'spawn', listener: () => void): unknown
  // `on`, not `once`: a second error of the process with no listener would
  // stop the dev server.
  on(event: 'error', listener: (error: Error & { code?: string }) => void): unknown
  once(event: 'exit', listener: (code: number | null) => void): unknown
  unref(): void
}

export type SpawnOptions = {
  cwd: string
  shell: boolean
  detached: true
  stdio: 'ignore'
  windowsHide: true
}

export type Spawn = (command: string, args: string[], options: SpawnOptions) => AgentProcess

export type AgentDeps = {
  // The host root: the folder in which the command starts, thus the code
  // editor takes the window of the folder where the agent works.
  root: string
  // The way of the setting `agent`.
  agent: AgentWay
  // The sentence for the agent.
  sentence: string
  platform: string
  spawn: Spawn
  // The wait for an error code, in ms.
  wait?: number
  // The environment of the dev server and a test for a file, to find the
  // command of the code editor when it is not on the path.
  env?: Env
  exists?: (path: string) => boolean
}

function sendAnswer(res: ServerResponse, answer: AgentAnswer | AgentWayAnswer) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(`${JSON.stringify(answer)}\n`)
}

// Starts the process and says how the start ended: an error of the system, an
// end within the wait, or a process that still runs after it. The process is
// detached with no streams, thus it lives on when the dev server stops.
function startOne(deps: AgentDeps, agent: AgentLine): Promise<AgentAnswer> {
  const { command, args, shell } = agentCommand(agent, deps.sentence, deps.platform)
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const done = (event: StartEvent) => {
      clearTimeout(timer)
      resolve(startResult(event, agent.command))
    }
    const child = deps.spawn(command, args, {
      cwd: deps.root,
      shell,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.on('error', (error) => done({ kind: 'error', code: error.code, message: error.message }))
    child.once('exit', (code) => done({ kind: 'exit', code }))
    child.once('spawn', () => {
      child.unref()
      timer = setTimeout(() => done({ kind: 'running' }), deps.wait ?? startWait)
    })
  })
}

// Tries each place of the command (`agentCommands`) until one starts. With
// none, the answer is the reason of a place that was there and failed, else
// of the command of the setting, which is the name that the user knows
// (`startFailure`), with the next step (`failedReason`).
async function start(deps: AgentDeps, way: Extract<AgentWay, { kind: 'command' }>): Promise<AgentAnswer> {
  const agent = way.line
  const commands = agentCommands(agent, deps.env ?? {}, deps.platform, deps.exists ?? (() => false))
  const failures: { command: string; reason: string }[] = []
  for (const command of commands) {
    let answer: AgentAnswer
    try {
      answer = await startOne(deps, { ...agent, command })
    } catch (error) {
      answer = { started: false, reason: messageOf(error) }
    }
    if (answer.started) return answer
    failures.push({ command, reason: answer.reason })
  }
  const reason = startFailure(failures, agent.command) ?? `the command "${agent.command}" was not found`
  return { started: false, reason: failedReason(way, reason) }
}

// The answer of `GET`: the way, with no command line.
export function wayAnswer(way: AgentWay): AgentWayAnswer {
  return way.kind === 'clipboard' ? { way: 'clipboard' } : { way: 'command', preset: way.preset }
}

// The middleware. The checks of a call come in this sequence: the address
// (the next middleware), the method (405), the origin (403; for `POST` only:
// the way is no secret, and a `GET` starts nothing).
export function createAgentHandler(deps: AgentDeps): Handler {
  return async function handle(req, res, next) {
    if (req.url?.split('?', 1)[0] !== agentAddress) {
      next()
      return
    }
    if (req.method === 'GET') {
      sendAnswer(res, wayAnswer(deps.agent))
      return
    }
    if (req.method !== 'POST') {
      sendText(res, 405, 'only GET gives the way, and only POST starts the agent command', { Allow: 'GET, POST' })
      return
    }
    if (!sameOrigin({ origin: req.headers.origin, host: req.headers.host })) {
      sendText(res, 403, otherOriginText)
      return
    }
    // The body is not read: it is thrown away.
    req.resume()

    const way = deps.agent
    if (way.kind === 'clipboard') {
      sendAnswer(res, { started: false, reason: noCommand })
      return
    }
    // `start` gives a refused command line and a start that threw as an
    // answer with its reason.
    sendAnswer(res, await start(deps, way))
  }
}

// The host root (`project.ts`), the folder where the agent works: the command
// starts there, thus the code editor takes its window. `agent` is the setting
// of the config of the project, and `guide` is the path of the guide of the
// project relative to the host, which the sentence names.
export type AgentOptions = { host: string; agent: AgentChoice; guide: string }

export function agentPlugin({ host, agent, guide }: AgentOptions): Plugin {
  const root = normalizePath(host)
  // The environment of the dev server decides `'auto'` one time.
  const way = agentOf(agent, process.env)
  const handle = createAgentHandler({
    root,
    agent: way,
    sentence: agentSentence(guide),
    platform: process.platform,
    spawn: (command, args, options) => spawnProcess(command, args, options),
    env: process.env,
    exists: existsSync,
  })

  return {
    name: 'canvas-agent',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(guarded(handle))
    },
  }
}
