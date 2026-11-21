import { afterEach, describe, expect, test, vi } from 'vitest'
import { formatRequest, type IssuesFile, type RequestFile } from '../../requests/format.ts'
import { requestsClient } from './client.ts'

const request: RequestFile = {
  version: 1,
  screen: 'onboarding/welcome',
  file: 'screens/onboarding/welcome.tsx',
  edits: [],
}

const issues: IssuesFile = { version: 1, screen: 'onboarding/welcome', file: 'screens/onboarding/welcome.tsx', issues: [] }

type Call = { address: string; method: string; headers: Record<string, string>; body?: string }

// Stubs `fetch` with one answer, or with an error, and records the calls.
function answer(make: () => Response | Promise<Response>) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', async (address: string, init: RequestInit = {}) => {
    calls.push({
      address,
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body as string | undefined,
    })
    return make()
  })
  return calls
}

const content = (status: number, text: string, etag: string | null = '"h1"') =>
  new Response(text, { status, headers: etag === null ? {} : { ETag: etag } })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestsClient', () => {
  test('loadRequest gives the file and the hash of the answer', async () => {
    const calls = answer(() => content(200, formatRequest(request)))
    expect(await requestsClient.loadRequest('onboarding/welcome')).toEqual({ status: 'loaded', file: request, hash: 'h1' })
    expect(calls).toEqual([
      { address: '/__canvas/requests/onboarding%2Fwelcome', method: 'GET', headers: {}, body: undefined },
    ])
  })

  test('saveRequest sends the base quoted in If-Match and gives the saved file', async () => {
    const calls = answer(() => content(200, formatRequest(request), '"h2"'))
    expect(await requestsClient.saveRequest(request, 'h1')).toEqual({ status: 'saved', file: request, hash: 'h2' })
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].headers).toEqual({ 'Content-Type': 'application/json', 'If-Match': '"h1"' })
    expect(calls[0].body).toBe(formatRequest(request))
  })

  test('a 409 answer is a conflict with the current content and its hash', async () => {
    const current = { ...request, edits: [] }
    answer(() => content(409, formatRequest(current), '"h3"'))
    expect(await requestsClient.saveRequest(request, 'h1')).toEqual({ status: 'conflict', file: current, hash: 'h3' })
  })

  test('never throws: a network error, an error answer, content that is not JSON, no ETag', async () => {
    answer(() => Promise.reject(new Error('offline')))
    expect(await requestsClient.loadRequest('a')).toEqual({ status: 'error', error: 'offline' })
    expect(await requestsClient.saveRequest(request, 'h1')).toEqual({ status: 'error', error: 'offline' })
    expect(await requestsClient.saveIssues(issues)).toEqual({ status: 'error', error: 'offline' })

    answer(() => content(500, 'disk full\n'))
    expect(await requestsClient.loadRequest('a')).toEqual({ status: 'error', error: '500 disk full' })
    expect(await requestsClient.saveIssues(issues)).toEqual({ status: 'error', error: '500 disk full' })

    answer(() => content(200, '{ edits'))
    expect(await requestsClient.loadRequest('a')).toMatchObject({ status: 'error' })

    answer(() => content(200, formatRequest(request), null))
    expect(await requestsClient.loadRequest('a')).toEqual({ status: 'error', error: 'the answer has no ETag' })
    answer(() => content(409, formatRequest(request), 'W/"h1"'))
    expect(await requestsClient.saveRequest(request, 'h1')).toEqual({ status: 'error', error: 'the answer has no ETag' })
  })

  test('saveIssues needs no ETag in the answer', async () => {
    const calls = answer(() => content(200, '{}', null))
    expect(await requestsClient.saveIssues(issues)).toEqual({ status: 'saved' })
    expect(calls[0]).toMatchObject({ address: '/__canvas/issues/onboarding%2Fwelcome', method: 'PUT' })
    expect(calls[0].headers).toEqual({ 'Content-Type': 'application/json' })
  })
})
