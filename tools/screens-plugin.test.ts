import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { formatTokens } from '../src/tokens/format.ts'
import { isFlowName, readFlowFiles, readTokenList, screensUpdate, type UpdateInput } from './screens-plugin.ts'

let root: string | null = null
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
  root = null
})

describe('readFlowFiles', () => {
  test('reads each flow.json with its flow, also in a sub folder and in the folder itself', () => {
    root = mkdtempSync(join(tmpdir(), 'canvas-flow-'))
    const folder = join(root, 'screens')
    mkdirSync(join(folder, 'a', 'forms'), { recursive: true })
    writeFileSync(join(folder, 'flow.json'), '{ "order": ["home"] }')
    writeFileSync(join(folder, 'a', 'flow.json'), '{ "order": ["one"] }')
    writeFileSync(join(folder, 'a', 'forms', 'flow.json'), 'x')
    writeFileSync(join(folder, 'a', 'other.json'), '{}')
    const files = readFlowFiles(root, folder).sort((x, y) => x.flow.localeCompare(y.flow))
    expect(files).toEqual([
      { flow: '', file: 'screens/flow.json', text: '{ "order": ["home"] }' },
      { flow: 'a', file: 'screens/a/flow.json', text: '{ "order": ["one"] }' },
      { flow: 'a/forms', file: 'screens/a/forms/flow.json', text: 'x' },
    ])
  })

  test('gives nothing for a folder that does not exist', () => {
    expect(readFlowFiles('/nowhere', '/nowhere/screens')).toEqual([])
  })
})

describe('isFlowName', () => {
  test('takes flow.json as a whole file name only', () => {
    expect(isFlowName('flow.json')).toBe(true)
    expect(isFlowName('/p/screens/a/flow.json')).toBe(true)
    expect(isFlowName('/p/screens/a/workflow.json')).toBe(false)
  })
})

describe('readTokenList', () => {
  test('the tokens of a valid file; null for no file, a file that is not JSON, and a list that is not valid', () => {
    root = mkdtempSync(join(tmpdir(), 'canvas-tokens-'))
    const file = join(root, 'tokens.json')
    expect(readTokenList(file)).toBeNull()
    writeFileSync(file, formatTokens([]))
    expect(readTokenList(file)).toEqual([])
    writeFileSync(file, '{')
    expect(readTokenList(file)).toBeNull()
    writeFileSync(file, '[{ "id": 1 }]')
    expect(readTokenList(file)).toBeNull()
  })
})

describe('screensUpdate', () => {
  const folder = '/p/screens'
  const input = (fields: Partial<UpdateInput>): UpdateInput => ({
    file: '/p/screens/a/one.tsx',
    type: 'update',
    folder,
    tokenFile: '/p/tokens.json',
    frames: true,
    components: '/p/components',
    listChanged: () => false,
    affected: () => ['a/one'],
    ...fields,
  })

  test('a change of an own component reloads the frames of the screens that use it', () => {
    const own = { file: '/p/components/Ring.tsx' }
    const reload = { invalidateModules: false, send: ['a/one'], result: 'none' }
    const pass = { invalidateModules: false, send: null, result: 'pass' }
    // A new or a removed component file changes no screen of the list: the map of the modules stays.
    for (const type of ['update', 'create', 'delete'] as const) expect(screensUpdate(input({ ...own, type }))).toEqual(reload)
    expect(screensUpdate(input({ ...own, affected: () => [] }))).toEqual(pass)
    expect(screensUpdate(input({ ...own, frames: false }))).toEqual(pass)
    // A folder with the same start is a file of no interest.
    expect(screensUpdate(input({ file: '/p/components-old/Ring.tsx' }))).toEqual(pass)
  })

  test('a new or removed screen file invalidates the map of the modules in the frame server, and never in the editor server', () => {
    for (const type of ['create', 'delete'] as const) {
      expect(screensUpdate(input({ type, listChanged: () => true }))).toEqual({ invalidateModules: true, send: ['a/one'], result: 'list' })
      expect(screensUpdate(input({ type, frames: false, listChanged: () => true }))).toEqual({
        invalidateModules: false,
        send: null,
        result: 'list',
      })
    }
  })

  test('an edit of a screen reloads its frames; the list updates only when it changed', () => {
    expect(screensUpdate(input({}))).toEqual({ invalidateModules: false, send: ['a/one'], result: 'none' })
    expect(screensUpdate(input({ listChanged: () => true })).result).toBe('list')
  })

  test('a flow.json updates only the list, and reloads no frame', () => {
    const update = screensUpdate(input({ file: '/p/screens/a/flow.json', affected: () => [], listChanged: () => true }))
    expect(update).toEqual({ invalidateModules: false, send: null, result: 'list' })
  })

  test('the token file updates the list with its modules only when the level changes', () => {
    let built = 0
    const changed = () => {
      built += 1
      return true
    }
    expect(screensUpdate(input({ file: '/p/tokens.json', listChanged: changed }))).toEqual({
      invalidateModules: false,
      send: null,
      result: 'withList',
    })
    expect(screensUpdate(input({ file: '/p/tokens.json' })).result).toBe('pass')
    expect(built).toBe(1)
  })

  test('a file outside the folder is left to the other plugins; a different file in it updates nothing', () => {
    let built = 0
    const listChanged = () => {
      built += 1
      return true
    }
    expect(screensUpdate(input({ file: '/p/src/x.ts', listChanged }))).toEqual({ invalidateModules: false, send: null, result: 'pass' })
    expect(screensUpdate(input({ file: '/p/screens/a/data.ts', frames: false, listChanged }))).toEqual({
      invalidateModules: false,
      send: null,
      result: 'none',
    })
    expect(built).toBe(0)
  })
})
