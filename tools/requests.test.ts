import { describe, expect, test } from 'vitest'
import { config } from '../canvas.config.ts'
import { formatIssues, formatRequest, type IssuesFile, type RequestFile } from '../src/requests/format.ts'
import {
  acceptBody,
  baseMatches,
  emptyRequest,
  hashOf,
  parseScreenAction,
  requestIdOf,
  routeOf,
  sameOrigin,
  screensRouteOf,
  workPath,
} from './requests.ts'

const ids = ['onboarding/welcome', 'settings']
const root = '/work/app'

const request: RequestFile = {
  version: 1,
  screen: 'onboarding/welcome',
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

const issues: IssuesFile = {
  version: 1,
  screen: 'onboarding/welcome',
  file: 'screens/onboarding/welcome.tsx',
  issues: [{ kind: 'render-error', text: 'Boom' }],
}

describe('workPath', () => {
  test('gives a path in the work folder for an id from the list', () => {
    expect(workPath('requests', 'onboarding/welcome', ids, root)).toBe(
      '/work/app/.canvas/requests/onboarding/welcome.json',
    )
    expect(workPath('issues', 'settings', ids, root)).toBe('/work/app/.canvas/issues/settings.json')
    expect(workPath('issues', 'settings', ids, '/work/app/')).toBe('/work/app/.canvas/issues/settings.json')
  })

  test('uses the work folder of the config', () => {
    // The guide in `guide/requests.md`, the skill `canvas-apply` and the older
    // fixed sentence (`src/editor/requests/agent-sentence.ts`) name the folder
    // too (`tools/guide.test.ts` checks them). Change them with it.
    expect(config.work).toBe('.canvas')
    expect(workPath('requests', 'settings', ids, root, 'tmp/work')).toBe('/work/app/tmp/work/requests/settings.json')
  })

  test('gives null for an unknown id', () => {
    expect(workPath('requests', 'missing', ids, root)).toBeNull()
    expect(workPath('requests', '', ids, root)).toBeNull()
  })

  test('gives null for an id with `..`, also when the list has it', () => {
    expect(workPath('requests', '../package', ids, root)).toBeNull()
    expect(workPath('requests', 'a/../b', ['a/../b'], root)).toBeNull()
    expect(workPath('requests', '..', ['..'], root)).toBeNull()
  })

  test('gives null for an unknown kind', () => {
    expect(workPath('tmp', 'settings', ids, root)).toBeNull()
    expect(workPath('', 'settings', ids, root)).toBeNull()
  })
})

describe('routeOf', () => {
  test('reads a request with GET and writes it with PUT', () => {
    expect(routeOf('GET', '/__canvas/requests/settings')).toEqual({ kind: 'requests', id: 'settings', action: 'read' })
    expect(routeOf('PUT', '/__canvas/requests/settings')).toEqual({
      kind: 'requests',
      id: 'settings',
      action: 'write',
    })
  })

  test('writes issues with PUT only', () => {
    expect(routeOf('PUT', '/__canvas/issues/settings')).toEqual({ kind: 'issues', id: 'settings', action: 'write' })
    expect(routeOf('GET', '/__canvas/issues/settings')).toBeNull()
  })

  test('takes an id with a slash', () => {
    expect(routeOf('GET', '/__canvas/requests/onboarding/welcome')?.id).toBe('onboarding/welcome')
  })

  test('decodes URL escapes in the id', () => {
    expect(routeOf('GET', '/__canvas/requests/onboarding%2Fwelcome')?.id).toBe('onboarding/welcome')
    expect(routeOf('GET', '/__canvas/requests/my%20screen')?.id).toBe('my screen')
  })

  test('drops the query part', () => {
    expect(routeOf('GET', '/__canvas/requests/settings?t=1')?.id).toBe('settings')
  })

  test('gives null for all other addresses and methods', () => {
    expect(routeOf('GET', '/')).toBeNull()
    expect(routeOf('GET', '/__canvas/requests/')).toBeNull()
    expect(routeOf('GET', '/__canvas/requests')).toBeNull()
    expect(routeOf('GET', '/__canvas/tmp/settings')).toBeNull()
    expect(routeOf('GET', '/x/__canvas/requests/settings')).toBeNull()
    expect(routeOf('DELETE', '/__canvas/requests/settings')).toBeNull()
    expect(routeOf('POST', '/__canvas/issues/settings')).toBeNull()
    expect(routeOf(undefined, '/__canvas/requests/settings')).toBeNull()
    expect(routeOf('GET', undefined)).toBeNull()
  })

  test('gives null for a broken escape', () => {
    expect(routeOf('GET', '/__canvas/requests/%E0%A4%A')).toBeNull()
  })
})

describe('sameOrigin', () => {
  test('passes a request with no Origin header', () => {
    expect(sameOrigin({ host: 'localhost:5173' })).toBe(true)
  })

  test('passes the origin of the host', () => {
    expect(sameOrigin({ origin: 'http://localhost:5173', host: 'localhost:5173' })).toBe(true)
    expect(sameOrigin({ origin: 'https://127.0.0.1:5173', host: '127.0.0.1:5173' })).toBe(true)
  })

  test('does not pass a different origin', () => {
    expect(sameOrigin({ origin: 'http://evil.example', host: 'localhost:5173' })).toBe(false)
    expect(sameOrigin({ origin: 'http://localhost:3000', host: 'localhost:5173' })).toBe(false)
    expect(sameOrigin({ origin: 'null', host: 'localhost:5173' })).toBe(false)
    expect(sameOrigin({ origin: 'http://localhost:5173' })).toBe(false)
  })
})

describe('acceptBody', () => {
  test('gives the formatted text of valid content', () => {
    expect(acceptBody('requests', JSON.stringify(request), 'onboarding/welcome')).toEqual({
      file: request,
      text: formatRequest(request),
    })
    expect(acceptBody('issues', JSON.stringify(issues), 'onboarding/welcome')).toEqual({
      file: issues,
      text: formatIssues(issues),
    })
  })

  test('gives an error for content that is not JSON', () => {
    expect(acceptBody('requests', '{ edits', 'onboarding/welcome')).toEqual({
      error: expect.stringMatching(/not JSON/),
    })
  })

  test('gives the error of the format check', () => {
    const result = acceptBody('requests', JSON.stringify({ ...request, version: 2 }), 'onboarding/welcome')
    expect(result).toEqual({ error: expect.stringMatching(/^request file: .*version/) })
    const bad = acceptBody('issues', JSON.stringify({ ...issues, issues: [{ kind: 'x' }] }), 'onboarding/welcome')
    expect(bad).toEqual({ error: expect.stringMatching(/^issues file: issue 1/) })
    expect(acceptBody('issues', JSON.stringify(request), 'onboarding/welcome')).toHaveProperty('error')
  })

  test('gives an error for a screen that is not the screen of the address', () => {
    expect(acceptBody('requests', JSON.stringify(request), 'settings')).toEqual({
      error: expect.stringMatching(/screen "onboarding\/welcome".*"settings"/),
    })
  })
})

describe('hashOf and baseMatches', () => {
  test('the same text gives the same hash, a different text a different hash', () => {
    expect(hashOf('abc')).toBe(hashOf('abc'))
    expect(hashOf('abc')).not.toBe(hashOf('abd'))
    expect(hashOf('abc')).toMatch(/^[0-9a-f]+$/)
  })

  test('the quoted hash of the text matches; another form does not', () => {
    const text = formatRequest(request)
    expect(baseMatches(`"${hashOf(text)}"`, text)).toBe(true)
    expect(baseMatches(hashOf(text), text)).toBe(false)
    expect(baseMatches(`W/"${hashOf(text)}"`, text)).toBe(false)
  })

  test('no file on the disk matches the hash of the empty request', () => {
    const empty = emptyRequest('onboarding/welcome')
    expect(JSON.parse(empty)).toEqual({
      version: 1,
      screen: 'onboarding/welcome',
      file: 'screens/onboarding/welcome.tsx',
      edits: [],
    })
    expect(empty).toBe(formatRequest(JSON.parse(empty)))
    expect(baseMatches(`"${hashOf(empty)}"`, empty)).toBe(true)
    expect(baseMatches(`"${hashOf(empty)}"`, formatRequest(request))).toBe(false)
  })

  test('a different text or no base does not match', () => {
    const text = formatRequest(request)
    expect(baseMatches(`"${hashOf(`${text} `)}"`, text)).toBe(false)
    expect(baseMatches(undefined, text)).toBe(false)
    expect(baseMatches('', text)).toBe(false)
  })
})

describe('requestIdOf', () => {
  const folder = '/work/app/.canvas/requests'

  test('gives the screen id of a request file', () => {
    expect(requestIdOf('/work/app/.canvas/requests/settings.json', folder)).toBe('settings')
    expect(requestIdOf('/work/app/.canvas/requests/onboarding/welcome.json', folder)).toBe('onboarding/welcome')
  })

  test('gives null for other files', () => {
    expect(requestIdOf('/work/app/.canvas/requests/settings.txt', folder)).toBeNull()
    expect(requestIdOf('/work/app/.canvas/issues/settings.json', folder)).toBeNull()
    expect(requestIdOf('/work/app/.canvas/tmp/a.json', folder)).toBeNull()
    expect(requestIdOf('/work/app/.canvas/requests', folder)).toBeNull()
    expect(requestIdOf('/work/app/.canvas/requests/.json', folder)).toBeNull()
  })
})

describe('screensRouteOf', () => {
  test('gives the action and the trash, and null for each other call', () => {
    expect(screensRouteOf('POST', '/__canvas/screens')).toBe('action')
    expect(screensRouteOf('POST', '/__canvas/screens?x=1')).toBe('action')
    expect(screensRouteOf('GET', '/__canvas/trash')).toBe('trash')
    expect(screensRouteOf('GET', '/__canvas/screens')).toBeNull()
    expect(screensRouteOf('POST', '/__canvas/trash')).toBeNull()
    expect(screensRouteOf('POST', '/__canvas/screens/a')).toBeNull()
    expect(screensRouteOf(undefined, undefined)).toBeNull()
  })
})

describe('parseScreenAction', () => {
  const parse = (value: unknown) => parseScreenAction(JSON.stringify(value))

  test('takes each action with its fields only', () => {
    expect(parse({ action: 'reorder', screen: 'a/b', to: 2, extra: true })).toEqual({ action: 'reorder', screen: 'a/b', to: 2 })
    expect(parse({ action: 'title', screen: 'a/b', title: 'New' })).toEqual({ action: 'title', screen: 'a/b', title: 'New' })
    expect(parse({ action: 'rename', screen: 'a/b', flow: '', name: 'c' })).toEqual({
      action: 'rename',
      screen: 'a/b',
      flow: '',
      name: 'c',
    })
    expect(parse({ action: 'delete', screen: 'a/b' })).toEqual({ action: 'delete', screen: 'a/b' })
    expect(parse({ action: 'restore', folder: '20261123-101500-a-b' })).toEqual({ action: 'restore', folder: '20261123-101500-a-b' })
  })

  test('gives an error for a body that is not an action', () => {
    expect(parseScreenAction('{')).toHaveProperty('error')
    expect(parse([])).toEqual({ error: 'the content must be an object' })
    expect(parse({ action: 'move', screen: 'a' })).toEqual({ error: '`action` must be reorder, title, rename, delete or restore' })
    expect(parse({ action: 'delete' })).toEqual({ error: '`screen` must be a text' })
    expect(parse({ action: 'delete', screen: '' })).toEqual({ error: '`screen` is empty' })
    expect(parse({ action: 'reorder', screen: 'a', to: 1.5 })).toEqual({ error: '`to` must be a whole number from 0' })
    expect(parse({ action: 'reorder', screen: 'a', to: '1' })).toEqual({ error: '`to` must be a whole number from 0' })
    expect(parse({ action: 'rename', screen: 'a', name: 'b' })).toEqual({ error: '`flow` must be a text' })
    expect(parse({ action: 'restore' })).toEqual({ error: '`folder` must be a text' })
  })
})
