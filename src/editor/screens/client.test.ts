import { afterEach, describe, expect, test, vi } from 'vitest'
import type { AppliedAction, TrashItem } from '../../requests/api.ts'
import { screensClient } from './client.ts'

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

const plan: AppliedAction = {
  action: 'delete',
  screen: 'onboarding/workspace',
  screens: [{ from: 'onboarding/workspace', to: null }],
  linkedBy: ['onboarding/welcome'],
  moves: [{ from: 'screens/onboarding/workspace.tsx', to: '.canvas/trash/x/screens/onboarding/workspace.tsx' }],
  writes: ['.canvas/trash/x/manifest.json'],
  removes: [],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('screensClient.run', () => {
  test('posts the action as JSON and gives the applied plan', async () => {
    const calls = answer(() => new Response(JSON.stringify({ applied: true, plan }), { status: 200 }))
    expect(await screensClient.run({ action: 'delete', screen: 'onboarding/workspace' })).toEqual({ status: 'applied', plan })
    expect(calls).toEqual([
      {
        address: '/__canvas/screens',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', screen: 'onboarding/workspace' }),
      },
    ])
  })

  test('409 gives the refusals', async () => {
    answer(() => new Response(JSON.stringify({ applied: false, refusals: ['a screen with the id x exists'] }), { status: 409 }))
    expect(await screensClient.run({ action: 'rename', screen: 'a', flow: '', name: 'x' })).toEqual({
      status: 'refused',
      refusals: ['a screen with the id x exists'],
    })
  })

  test('a different status, a network error and an answer that is not JSON give an error', async () => {
    answer(() => new Response('no screen "a"\n', { status: 404 }))
    expect(await screensClient.run({ action: 'delete', screen: 'a' })).toEqual({ status: 'error', error: '404 no screen "a"' })
    answer(() => Promise.reject(new Error('offline')))
    expect(await screensClient.run({ action: 'delete', screen: 'a' })).toEqual({ status: 'error', error: 'offline' })
    answer(() => new Response('<html>', { status: 200 }))
    expect((await screensClient.run({ action: 'delete', screen: 'a' })).status).toBe('error')
  })
})

describe('screensClient.trash', () => {
  test('gives the items of the trash', async () => {
    const items: TrashItem[] = [{ folder: 'x', screen: 'a', files: ['screens/a.tsx'], time: '2026-11-23T10:15:00.000Z' }]
    const calls = answer(() => new Response(JSON.stringify({ items }), { status: 200 }))
    expect(await screensClient.trash()).toEqual({ status: 'loaded', items })
    expect(calls[0]).toMatchObject({ address: '/__canvas/trash', method: 'GET' })
  })

  test('an answer that is not a success gives an error', async () => {
    answer(() => new Response('only the editor of this server can use this address', { status: 403 }))
    expect(await screensClient.trash()).toEqual({
      status: 'error',
      error: '403 only the editor of this server can use this address',
    })
  })
})

describe('the content of an answer', () => {
  test('an answer of another form is an error, not a plan', async () => {
    answer(() => new Response(JSON.stringify({ applied: true }), { status: 200 }))
    expect(await screensClient.run({ action: 'delete', screen: 'onboarding/workspace' })).toEqual({
      status: 'error',
      error: 'The dev server gave an answer that the editor cannot read',
    })
    answer(() => new Response(JSON.stringify({ applied: false, refusals: [1] }), { status: 409 }))
    expect((await screensClient.run({ action: 'delete', screen: 'onboarding/workspace' })).status).toBe('error')
    answer(() => new Response('null', { status: 200 }))
    expect((await screensClient.run({ action: 'delete', screen: 'onboarding/workspace' })).status).toBe('error')
  })

  test('a trash of another form is an error', async () => {
    answer(() => new Response(JSON.stringify({ items: [{ folder: 'x' }] }), { status: 200 }))
    expect((await screensClient.trash()).status).toBe('error')
    answer(() => new Response(JSON.stringify({}), { status: 200 }))
    expect((await screensClient.trash()).status).toBe('error')
  })
})
