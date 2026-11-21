import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { config } from '../canvas.config.ts'
import { bodyLimit, quotedHash } from '../src/requests/api.ts'
import { formatRequest, type IssuesFile, type RequestFile } from '../src/requests/format.ts'
import { createRequestsHandler, type Handler } from './requests-plugin.ts'
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
  handle = createRequestsHandler({ root: () => root, screenIds: () => [id] })
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
})
