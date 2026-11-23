import { describe, expect, test } from 'vitest'
import type { PackState } from './pack.ts'
import { entryTokens, tokenAction, unknownField, watchedFolders } from './token-state.ts'

const root = '/project'
const one = { kind: 'one', pack: { name: 'sample', sources: ['sample-ui'], folder: 'packs/sample' } } as const satisfies PackState

describe('tokenAction', () => {
  test('a pack loads the token entry of the pack', () => {
    expect(tokenAction(one, root, 'tokens.json')).toEqual({
      kind: 'load',
      path: '/project/packs/sample/library/tokens.ts',
    })
  })

  test('a root with a trailing slash gives the same path', () => {
    expect(tokenAction(one, '/project/', 'tokens.json')).toEqual({
      kind: 'load',
      path: '/project/packs/sample/library/tokens.ts',
    })
  })

  test('no pack writes nothing and says why', () => {
    expect(tokenAction({ kind: 'none' }, root, 'tokens.json')).toEqual({
      kind: 'skip',
      message: 'no library is connected: tokens.json is not written',
    })
  })

  test('an error of the pack state stops with its message', () => {
    const message = 'more than one library pack: packs/a, packs/b'
    expect(tokenAction({ kind: 'error', message }, root, 'tokens.json')).toEqual({
      kind: 'fail',
      message: `tokens.json is not written: ${message}`,
    })
  })
})

describe('watchedFolders', () => {
  test('a pack gives its library folder, and each folder source in the host', () => {
    expect(watchedFolders(one.pack, '/h/canvas', '/h')).toEqual(['/h/canvas/packs/sample/library'])
    const folders = { ...one.pack, sources: ['sample-ui', './src/ui', '/abs/theme'] }
    expect(watchedFolders(folders, '/h/canvas', '/h')).toEqual(['/h/canvas/packs/sample/library', '/h/src/ui', '/abs/theme'])
  })

  test('no pack gives no folder', () => {
    expect(watchedFolders(null, '/h/canvas', '/h')).toEqual([])
  })
})

describe('entryTokens', () => {
  const path = '/project/packs/sample/library/tokens.ts'

  test('gives the result of the function tokens of the module', async () => {
    const list = [{ id: 'a' }]
    expect(await entryTokens({ tokens: () => list }, path)).toBe(list)
  })

  test('waits for a function tokens that gives a promise', async () => {
    const list = [{ id: 'a' }]
    expect(await entryTokens({ tokens: async () => list }, path)).toBe(list)
  })

  test('a module with no function tokens is an error that names the entry', async () => {
    const error = `${path} must export a function tokens()`
    await expect(entryTokens({}, path)).rejects.toThrow(error)
    await expect(entryTokens({ tokens: [] }, path)).rejects.toThrow(error)
    await expect(entryTokens(null, path)).rejects.toThrow(error)
  })
})

describe('unknownField', () => {
  const token = { id: 'c.primary', group: 'color', name: 'primary', value: '#000', code: 'primary' }

  test('null for the fields of the format', () => {
    expect(unknownField([token, { ...token, id: 'b', cssVar: '--b', media: [{ query: '(min-width: 1px)', value: '#fff' }] }])).toBeNull()
  })

  test('names the first field that the format does not have', () => {
    expect(unknownField([token, { ...token, id: 'b', note: 'x' }])).toBe('token 2 "b" has the field "note", which the token format does not have')
    expect(unknownField([{ ...token, media: [{ query: 'q', value: 'v', when: 1 }] }])).toContain('a media value with the field "when"')
  })
})
