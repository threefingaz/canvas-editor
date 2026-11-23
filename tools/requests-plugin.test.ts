import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { config } from '../canvas.config.ts'
import { bodyLimit, quotedHash, type ActionAnswer, type TrashAnswer } from '../src/requests/api.ts'
import { formatRequest, type IssuesFile, type RequestFile } from '../src/requests/format.ts'
import { createRequestsHandler, type Handler } from './requests-plugin.ts'
import { screenNames } from './screens-plugin.ts'
import { emptyRequest, hashOf } from './requests.ts'

const id = 'onboarding/welcome'

const request: RequestFile = {
  version: 1,
  screen: id,
  file: 'screens/onboarding/welcome.tsx',
  edits: [
    {
      id: 'e1',
      target: {
        file: 'screens/onboarding/welcome.tsx',
        line: 12,
        column: 7,
        tag: 'Button',
        origin: 'library',
        element: 'button',
        copies: 1,
        label: 'Get started',
      },
      width: 390,
      change: { kind: 'remove' },
    },
  ],
}

const issues: IssuesFile = { version: 1, screen: id, file: request.file, issues: [{ kind: 'render-error', text: 'Boom' }] }

type Answer = { status: number; headers: Record<string, string>; body: string; next: boolean }

let root: string
let handle: Handler

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canvas-api-'))
  handle = createRequestsHandler({ root, screenIds: () => [id] })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const requestPath = () => join(root, config.work, 'requests', `${id}.json`)
const issuesPath = () => join(root, config.work, 'issues', `${id}.json`)

// One call with plain objects in place of the request and the answer of the
// server.
async function call(
  method: string,
  url: string,
  options: { body?: string | Buffer; headers?: Record<string, string> } = {},
): Promise<Answer> {
  const body = options.body === undefined ? [] : [Buffer.from(options.body)]
  const req = Object.assign(Readable.from(body), {
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

const json = { 'content-type': 'application/json' }
const address = `/__canvas/requests/${encodeURIComponent(id)}`
const put = (body: string, headers: Record<string, string> = {}) =>
  call('PUT', address, { body, headers: { ...json, ...headers } })
const ifMatch = (text: string) => ({ 'if-match': quotedHash(hashOf(text)) })

describe('createRequestsHandler', () => {
  test('an address outside the API goes to the next middleware; an unknown API address is 404', async () => {
    expect((await call('GET', '/index.html')).next).toBe(true)
    expect((await call('GET', '/__canvas/other/a')).status).toBe(404)
    expect((await call('GET', `/__canvas/issues/${id}`)).status).toBe(404)
  })

  test('a different origin is 403, an unknown screen 404', async () => {
    expect((await call('GET', address, { headers: { origin: 'https://other.example' } })).status).toBe(403)
    expect((await call('GET', '/__canvas/requests/missing')).status).toBe(404)
  })

  test('GET with no file gives the empty request with its ETag', async () => {
    const answer = await call('GET', address)
    expect(answer.status).toBe(200)
    expect(answer.body).toBe(emptyRequest(id))
    expect(answer.headers.ETag).toBe(quotedHash(hashOf(emptyRequest(id))))
  })

  test('the checks of a PUT: 415, 413, 400, 428, 409', async () => {
    const text = formatRequest(request)
    expect((await call('PUT', address, { body: text, headers: { 'content-type': 'text/plain' } })).status).toBe(415)
    expect((await put(text, { 'content-length': String(bodyLimit + 1) })).status).toBe(413)
    expect((await call('PUT', address, { body: Buffer.alloc(bodyLimit + 1, 32), headers: json })).status).toBe(413)
    expect((await put('{ edits')).status).toBe(400)
    expect((await put(JSON.stringify({ ...request, screen: 'settings' }))).status).toBe(400)
    expect((await put(text)).status).toBe(428)
    // A base that is not the text on the disk: the answer has the current
    // content and its hash, and nothing is written.
    const stale = await put(text, ifMatch('old text'))
    expect(stale.status).toBe(409)
    expect(stale.body).toBe(emptyRequest(id))
    expect(stale.headers.ETag).toBe(quotedHash(hashOf(emptyRequest(id))))
    expect(existsSync(requestPath())).toBe(false)
  })

  test('a PUT on its base writes the file, and GET reads it', async () => {
    const text = formatRequest(request)
    const saved = await put(JSON.stringify(request), ifMatch(emptyRequest(id)))
    expect(saved.status).toBe(200)
    expect(saved.body).toBe(text)
    expect(saved.headers.ETag).toBe(quotedHash(hashOf(text)))
    expect(readFileSync(requestPath(), 'utf8')).toBe(text)
    expect((await call('GET', address)).body).toBe(text)
    // The old base no longer matches.
    expect((await put(text, ifMatch(emptyRequest(id)))).status).toBe(409)
  })

  test('a PUT with no edits deletes the file and gives the empty request', async () => {
    const text = formatRequest(request)
    await put(text, ifMatch(emptyRequest(id)))
    const answer = await put(JSON.stringify({ ...request, edits: [] }), ifMatch(text))
    expect(answer.status).toBe(200)
    expect(answer.body).toBe(emptyRequest(id))
    expect(answer.headers.ETag).toBe(quotedHash(hashOf(emptyRequest(id))))
    expect(existsSync(requestPath())).toBe(false)
  })

  test('an issues file needs no If-Match', async () => {
    const answer = await call('PUT', `/__canvas/issues/${encodeURIComponent(id)}`, {
      body: JSON.stringify(issues),
      headers: json,
    })
    expect(answer.status).toBe(200)
    expect(JSON.parse(readFileSync(issuesPath(), 'utf8'))).toEqual(issues)
  })

  test('a screen that goes while the body comes in is 404, and no file is written', async () => {
    // The first look at the list (the address) has the screen; the look after
    // the body has not: a delete ran in between.
    let looks = 0
    handle = createRequestsHandler({ root, screenIds: () => (looks++ === 0 ? [id] : []) })
    const answer = await call('PUT', `/__canvas/issues/${encodeURIComponent(id)}`, { body: JSON.stringify(issues), headers: json })
    expect(answer.status).toBe(404)
    expect(existsSync(issuesPath())).toBe(false)
  })
})

describe('the screen actions', () => {
  const screen = (meta: string, body = '<Stack />') => `import { Button, Stack } from '@lib/core'

export const meta = ${meta}

export default function Screen() {
  return ${body}
}
`
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  const read = (path: string) => readFileSync(join(root, path), 'utf8')
  const time = new Date('2026-11-23T10:15:00Z')

  beforeEach(() => {
    handle = createRequestsHandler({
      root,
      screenIds: () => screenNames(join(root, config.screens)).map((name) => name.slice(0, -'.tsx'.length)),
      now: () => time,
    })
    write('screens/onboarding/welcome.tsx', screen(`{ title: 'Welcome', width: 1440 }`, '<Button href="#/onboarding/workspace">Next</Button>'))
    write('screens/onboarding/workspace.tsx', screen(`{ title: 'Workspace', width: 1440 }`))
    write(
      'screens/onboarding/workspace-error.tsx',
      screen(`{ title: 'Workspace, error', width: 1440, stateOf: 'onboarding/workspace' }`),
    )
    write('screens/onboarding/flow.json', `${JSON.stringify({ order: ['workspace', 'welcome'] }, null, 2)}\n`)
    write(
      '.canvas/requests/onboarding/workspace.json',
      formatRequest({
        ...request,
        screen: 'onboarding/workspace',
        file: 'screens/onboarding/workspace.tsx',
        edits: request.edits.map((edit) => ({ ...edit, target: { ...edit.target!, file: 'screens/onboarding/workspace.tsx' } })),
      }),
    )
  })

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    call('POST', '/__canvas/screens', { body: JSON.stringify(body), headers: { ...json, ...headers } })
  const answerOf = (answer: Answer) => JSON.parse(answer.body) as ActionAnswer

  test('a move in the row writes flow.json', async () => {
    const answer = await post({ action: 'reorder', screen: 'onboarding/welcome', to: 0 })
    expect(answer.status).toBe(200)
    expect(answerOf(answer)).toEqual({
      applied: true,
      plan: {
        action: 'reorder',
        screen: 'onboarding/welcome',
        screens: [],
        linkedBy: [],
        moves: [],
        writes: ['screens/onboarding/flow.json'],
        removes: [],
      },
    })
    expect(JSON.parse(read('screens/onboarding/flow.json'))).toEqual({ order: ['welcome', 'workspace'] })
  })

  test('an action takes the widths of the project: a screen of a width that they do not have is a file with an error', async () => {
    write('screens/onboarding/wide.tsx', screen(`{ title: 'Wide', width: 1280 }`))
    const refused = await post({ action: 'title', screen: 'onboarding/wide', title: 'Wider' })
    expect(refused.status).toBe(409)
    handle = createRequestsHandler({
      root,
      widths: [1440, 1280],
      screenIds: () => screenNames(join(root, config.screens)).map((name) => name.slice(0, -'.tsx'.length)),
    })
    const answer = await post({ action: 'title', screen: 'onboarding/wide', title: 'Wider' })
    expect(answer.status).toBe(200)
    expect(read('screens/onboarding/wide.tsx')).toContain(`title: 'Wider'`)
  })

  test('a new title replaces the literal', async () => {
    const answer = await post({ action: 'title', screen: 'onboarding/welcome', title: "Hello, it's me" })
    expect(answer.status).toBe(200)
    expect(read('screens/onboarding/welcome.tsx')).toContain(`title: 'Hello, it\\'s me'`)
  })

  test('a rename moves the screen, its state and its request file, and changes the links', async () => {
    const answer = await post({ action: 'rename', screen: 'onboarding/workspace', flow: 'onboarding', name: 'team' })
    expect(answer.status).toBe(200)
    const result = answerOf(answer)
    expect(result.applied && result.plan.screens).toEqual([
      { from: 'onboarding/workspace', to: 'onboarding/team' },
      { from: 'onboarding/workspace-error', to: 'onboarding/team-error' },
    ])
    expect(existsSync(join(root, 'screens/onboarding/workspace.tsx'))).toBe(false)
    expect(read('screens/onboarding/team-error.tsx')).toContain(`stateOf: 'onboarding/team'`)
    expect(read('screens/onboarding/welcome.tsx')).toContain('href="#/onboarding/team"')
    expect(JSON.parse(read('.canvas/requests/onboarding/team.json'))).toMatchObject({
      screen: 'onboarding/team',
      file: 'screens/onboarding/team.tsx',
    })
    expect(JSON.parse(read('screens/onboarding/flow.json'))).toEqual({ order: ['team', 'welcome'] })
  })

  test('a rename to an id that exists is 409 with the refusal, and changes nothing', async () => {
    const answer = await post({ action: 'rename', screen: 'onboarding/workspace', flow: 'onboarding', name: 'welcome' })
    expect(answer.status).toBe(409)
    expect(answerOf(answer)).toEqual({ applied: false, refusals: ["a screen with the id 'onboarding/welcome' exists"] })
    expect(existsSync(join(root, 'screens/onboarding/workspace.tsx'))).toBe(true)
  })

  test('a delete moves the screens into the trash and names the screens that link to it; the trash lists it; a restore puts it back', async () => {
    const answer = await post({ action: 'delete', screen: 'onboarding/workspace' })
    expect(answer.status).toBe(200)
    const result = answerOf(answer)
    expect(result.applied && result.plan.linkedBy).toEqual(['onboarding/welcome'])
    expect(result.applied && result.plan.screens).toEqual([
      { from: 'onboarding/workspace', to: null },
      { from: 'onboarding/workspace-error', to: null },
    ])
    expect(existsSync(join(root, 'screens/onboarding/workspace.tsx'))).toBe(false)
    expect(existsSync(join(root, '.canvas/requests/onboarding/workspace.json'))).toBe(false)

    const trash = await call('GET', '/__canvas/trash')
    expect(trash.status).toBe(200)
    const { items } = JSON.parse(trash.body) as TrashAnswer
    expect(items).toEqual([
      {
        folder: '20261123-101500-onboarding-workspace',
        screen: 'onboarding/workspace',
        files: [
          'screens/onboarding/workspace.tsx',
          '.canvas/requests/onboarding/workspace.json',
          'screens/onboarding/workspace-error.tsx',
        ],
        time: time.toISOString(),
      },
    ])

    const restored = await post({ action: 'restore', folder: items[0].folder })
    expect(restored.status).toBe(200)
    expect(answerOf(restored)).toMatchObject({
      applied: true,
      plan: { screens: [{ from: null, to: 'onboarding/workspace' }, { from: null, to: 'onboarding/workspace-error' }] },
    })
    expect(existsSync(join(root, 'screens/onboarding/workspace.tsx'))).toBe(true)
    expect(JSON.parse(read('screens/onboarding/flow.json'))).toEqual({ order: ['workspace', 'welcome'] })
    expect(readdirSync(join(root, '.canvas/trash'))).toEqual([])
    expect(JSON.parse((await call('GET', '/__canvas/trash')).body)).toEqual({ items: [] })
  })

  test('a restore of a folder that the trash does not have is 409', async () => {
    const answer = await post({ action: 'restore', folder: 'missing' })
    expect(answer.status).toBe(409)
    expect(answerOf(answer)).toEqual({ applied: false, refusals: ["the trash has no folder 'missing'"] })
  })

  test('a different origin is 403 for an action and for the trash, and changes nothing', async () => {
    const other = { origin: 'https://other.example' }
    expect((await post({ action: 'delete', screen: 'onboarding/workspace' }, other)).status).toBe(403)
    expect((await call('GET', '/__canvas/trash', { headers: other })).status).toBe(403)
    expect(existsSync(join(root, 'screens/onboarding/workspace.tsx'))).toBe(true)
  })

  test('an unknown screen is 404, also for a screen in the trash', async () => {
    expect((await post({ action: 'delete', screen: 'onboarding/missing' })).status).toBe(404)
    await post({ action: 'delete', screen: 'onboarding/workspace' })
    expect((await post({ action: 'title', screen: 'onboarding/workspace', title: 'Back' })).status).toBe(404)
  })

  test('a body that is not an action is 400; a different content type is 415; a different method is 404', async () => {
    expect((await post({ action: 'move', screen: 'onboarding/welcome' })).status).toBe(400)
    expect((await post({ action: 'reorder', screen: 'onboarding/welcome', to: -1 })).status).toBe(400)
    expect((await post({ action: 'title', screen: 'onboarding/welcome' })).status).toBe(400)
    expect((await call('POST', '/__canvas/screens', { body: '{}' })).status).toBe(415)
    expect((await call('GET', '/__canvas/screens')).status).toBe(404)
    expect((await call('POST', '/__canvas/trash', { body: '{}', headers: json })).status).toBe(404)
  })

  test('a body over the limit is 413, and changes nothing', async () => {
    const big = { ...json, 'content-length': String(bodyLimit + 1) }
    expect((await post({ action: 'reorder', screen: 'onboarding/welcome', to: 0 }, big)).status).toBe(413)
    expect((await call('POST', '/__canvas/screens', { body: Buffer.alloc(bodyLimit + 1, 32), headers: json })).status).toBe(413)
    expect(JSON.parse(read('screens/onboarding/flow.json'))).toEqual({ order: ['workspace', 'welcome'] })
  })

  test('a step of the action that fails is 500, and the files are as before', async () => {
    // A folder where the action writes flow.json: the write fails.
    rmSync(join(root, 'screens/onboarding/flow.json'))
    mkdirSync(join(root, 'screens/onboarding/flow.json'))
    const answer = await post({ action: 'reorder', screen: 'onboarding/welcome', to: 0 })
    expect(answer.status).toBe(500)
    expect(answer.body).toContain('the action failed')
    expect(statSync(join(root, 'screens/onboarding/flow.json')).isDirectory()).toBe(true)
    expect(readdirSync(join(root, '.canvas/tmp'))).toEqual([])
  })
})
