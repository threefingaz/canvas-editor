import { describe, expect, test } from 'vitest'
import type { PackState } from './pack.ts'
import { entryTokens, tokenAction, watchedLibraryFolder } from './token-state.ts'

const root = '/project'
const one = { kind: 'one', pack: { name: 'sample', package: 'sample-ui', folder: 'packs/sample' } } as const satisfies PackState

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

describe('watchedLibraryFolder', () => {
  test('a pack gives its library folder', () => {
    expect(watchedLibraryFolder(one.pack)).toBe('packs/sample/library')
  })

  test('no pack gives no folder', () => {
    expect(watchedLibraryFolder(null)).toBeNull()
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
