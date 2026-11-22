import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  choosePack,
  noProviderMessage,
  packChange,
  packLibraryFolder,
  packOf,
  providerPath,
  readPackState,
  tokensEntryPath,
  touchesPackState,
  type Pack,
  type PackState,
} from './pack.ts'

const mui = JSON.stringify({ name: 'mui', package: '@mui/material' })

function errorOf(state: PackState): string {
  if (state.kind !== 'error') throw new Error(`expected an error, got ${state.kind}`)
  return state.message
}

describe('choosePack', () => {
  test('no manifest gives no pack', () => {
    expect(choosePack([])).toEqual({ kind: 'none' })
  })

  test('one valid manifest gives that pack', () => {
    expect(choosePack([{ folder: 'mui', text: mui }])).toEqual({
      kind: 'one',
      pack: { name: 'mui', package: '@mui/material', folder: 'packs/mui' },
    })
  })

  test('a name with hyphens and numbers is valid', () => {
    const text = JSON.stringify({ name: 'my-lib-2', package: '@acme/ui' })
    expect(choosePack([{ folder: 'my-lib-2', text }]).kind).toBe('one')
  })

  test('two packs give an error that names the two', () => {
    const other = JSON.stringify({ name: 'other', package: 'other-ui' })
    const message = errorOf(choosePack([{ folder: 'other', text: other }, { folder: 'mui', text: mui }]))
    expect(message).toContain('more than one library pack')
    expect(message).toContain('packs/mui, packs/other')
  })

  test('a manifest with no package is an error', () => {
    const text = JSON.stringify({ name: 'mui' })
    expect(errorOf(choosePack([{ folder: 'mui', text }]))).toBe('packs/mui/pack.json has no "package"')
  })

  test('reads the keys of the scales, and takes a manifest with no list', () => {
    const text = JSON.stringify({ name: 'mui', package: '@mui/material', scaleKeys: ['padding', 'gap'] })
    const state = choosePack([{ folder: 'mui', text }])
    expect(state.kind === 'one' && state.pack.scaleKeys).toEqual(['padding', 'gap'])
    const plain = choosePack([{ folder: 'mui', text: JSON.stringify({ name: 'mui', package: '@mui/material' }) }])
    expect(plain.kind === 'one' && 'scaleKeys' in plain.pack).toBe(false)
  })

  test('a list of scale keys that is not a list of texts is an error', () => {
    for (const scaleKeys of ['padding', [1], ['']]) {
      const text = JSON.stringify({ name: 'mui', package: '@mui/material', scaleKeys })
      expect(errorOf(choosePack([{ folder: 'mui', text }]))).toBe('packs/mui/pack.json: "scaleKeys" must be a list of texts')
    }
  })

  test('an empty package is an error', () => {
    const text = JSON.stringify({ name: 'mui', package: '' })
    expect(errorOf(choosePack([{ folder: 'mui', text }]))).toBe('packs/mui/pack.json has no "package"')
  })

  test('a manifest with no name is an error', () => {
    const text = JSON.stringify({ package: '@mui/material' })
    expect(errorOf(choosePack([{ folder: 'mui', text }]))).toBe('packs/mui/pack.json has no "name"')
  })

  test('a name that differs from the folder is an error', () => {
    const message = errorOf(choosePack([{ folder: 'material', text: mui }]))
    expect(message).toContain('packs/material/pack.json')
    expect(message).toContain('the same as the folder name "material"')
  })

  test('a name with uppercase letters is an error', () => {
    const text = JSON.stringify({ name: 'MUI', package: '@mui/material' })
    expect(errorOf(choosePack([{ folder: 'MUI', text }]))).toContain('only lowercase letters')
  })

  test('a manifest that is not JSON is an error', () => {
    expect(errorOf(choosePack([{ folder: 'mui', text: '{ name: mui' }]))).toContain(
      'packs/mui/pack.json is not valid JSON',
    )
  })

  test('a manifest that is not an object is an error', () => {
    expect(errorOf(choosePack([{ folder: 'mui', text: '["mui"]' }]))).toContain('must be an object')
  })
})

describe('readPackState', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canvas-pack-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function writePack(folder: string, text: string) {
    mkdirSync(join(root, 'packs', folder), { recursive: true })
    writeFileSync(join(root, 'packs', folder, 'pack.json'), text)
  }

  test('no packs folder gives no pack', () => {
    expect(readPackState(root, {})).toEqual({ kind: 'none' })
  })

  test('an empty packs folder gives no pack', () => {
    mkdirSync(join(root, 'packs'))
    writeFileSync(join(root, 'packs', '.gitkeep'), '')
    expect(readPackState(root, {})).toEqual({ kind: 'none' })
  })

  test('reads the one pack', () => {
    writePack('mui', mui)
    expect(readPackState(root, {})).toEqual({
      kind: 'one',
      pack: { name: 'mui', package: '@mui/material', folder: 'packs/mui' },
    })
  })

  test('a folder with no manifest is not a pack', () => {
    writePack('mui', mui)
    mkdirSync(join(root, 'packs', 'notes'))
    expect(readPackState(root, {}).kind).toBe('one')
  })

  test('two packs give an error', () => {
    writePack('mui', mui)
    writePack('other', JSON.stringify({ name: 'other', package: 'other-ui' }))
    expect(errorOf(readPackState(root, {}))).toContain('packs/mui, packs/other')
  })

  test('a link to a folder with a manifest is a pack', () => {
    const outside = join(root, 'outside', 'mui')
    mkdirSync(outside, { recursive: true })
    writeFileSync(join(outside, 'pack.json'), mui)
    mkdirSync(join(root, 'packs'))
    symlinkSync(outside, join(root, 'packs', 'mui'), 'dir')
    expect(readPackState(root, {})).toEqual({
      kind: 'one',
      pack: { name: 'mui', package: '@mui/material', folder: 'packs/mui' },
    })
  })

  test('a link to a file or a broken link is not a pack', () => {
    mkdirSync(join(root, 'packs'))
    writeFileSync(join(root, 'file.txt'), 'x')
    symlinkSync(join(root, 'file.txt'), join(root, 'packs', 'file'))
    symlinkSync(join(root, 'missing'), join(root, 'packs', 'broken'))
    expect(readPackState(root, {})).toEqual({ kind: 'none' })
  })

  test('CANVAS_NO_PACK=1 gives no pack with a pack on the disk', () => {
    writePack('mui', mui)
    expect(readPackState(root, { CANVAS_NO_PACK: '1' })).toEqual({ kind: 'none' })
  })

  test('CANVAS_NO_PACK=1 also hides an error', () => {
    writePack('mui', '{')
    expect(readPackState(root, { CANVAS_NO_PACK: '1' })).toEqual({ kind: 'none' })
  })

  test('another value of CANVAS_NO_PACK keeps the pack', () => {
    writePack('mui', mui)
    expect(readPackState(root, { CANVAS_NO_PACK: '0' }).kind).toBe('one')
  })
})

const pack = { name: 'mui', package: '@mui/material', folder: 'packs/mui' }

describe('packOf', () => {
  test('gives the pack of one pack and null with no pack', () => {
    expect(packOf({ kind: 'one', pack })).toBe(pack)
    expect(packOf({ kind: 'none' })).toBeNull()
  })

  test('throws the message of an error', () => {
    expect(() => packOf({ kind: 'error', message: 'more than one library pack' })).toThrow(
      'canvas library: more than one library pack',
    )
  })
})

describe('touchesPackState', () => {
  const root = '/project'

  test('the packs folder, a folder in it and a manifest touch the state', () => {
    expect(touchesPackState('/project/packs', root)).toBe(true)
    expect(touchesPackState('/project/packs/mui', root)).toBe(true)
    expect(touchesPackState('/project/packs/mui/pack.json', root)).toBe(true)
    expect(touchesPackState('/project/packs/mui/pack.json', '/project/')).toBe(true)
  })

  test('the library folder of a pack and its provider touch the state', () => {
    expect(touchesPackState('/project/packs/mui/library', root)).toBe(true)
    expect(touchesPackState('/project/packs/mui/library/provider.tsx', root)).toBe(true)
  })

  test('other files of a pack and other folders do not', () => {
    expect(touchesPackState('/project/packs/mui/package.json', root)).toBe(false)
    expect(touchesPackState('/project/packs/mui/library/pack.json', root)).toBe(false)
    expect(touchesPackState('/project/packs/mui/library/theme.ts', root)).toBe(false)
    expect(touchesPackState('/project/packs/mui/library/sub/provider.tsx', root)).toBe(false)
    expect(touchesPackState('/project/packs/mui/provider.tsx', root)).toBe(false)
    expect(touchesPackState('/project/screens/pack.json', root)).toBe(false)
    expect(touchesPackState('/project/my-packs/mui/pack.json', root)).toBe(false)
    expect(touchesPackState('/project-2/packs/mui/pack.json', root)).toBe(false)
  })
})

describe('providerPath', () => {
  test('is the provider file in the pack folder under the root', () => {
    expect(providerPath(pack, '/project')).toBe(`/project/${pack.folder}/library/provider.tsx`)
    expect(noProviderMessage(pack, '/project')).toBe(
      `the pack ${pack.folder} has no library/provider.tsx: /project/${pack.folder}/library/provider.tsx does not exist`,
    )
  })
})

describe('tokensEntryPath and packLibraryFolder', () => {
  test('the token entry is in the library folder of the pack under the root', () => {
    expect(tokensEntryPath(pack, '/project')).toBe(`/project/${pack.folder}/library/tokens.ts`)
    expect(tokensEntryPath(pack, '/project/')).toBe(`/project/${pack.folder}/library/tokens.ts`)
  })

  test('the library folder is relative to the project root', () => {
    expect(packLibraryFolder(pack)).toBe(`${pack.folder}/library`)
  })
})

describe('packChange', () => {
  const root = '/project'
  const ready = () => true
  const change = (current: Pack | null, next: PackState) => packChange(current, next, root, ready)

  test('the same pack, or no pack before and after, changes nothing', () => {
    expect(change(pack, { kind: 'one', pack: { ...pack } })).toEqual({ kind: 'same' })
    expect(change(null, { kind: 'none' })).toEqual({ kind: 'same' })
  })

  test('a pack that came, went or changed restarts the server', () => {
    expect(change(null, { kind: 'one', pack })).toEqual({ kind: 'restart' })
    expect(change(pack, { kind: 'none' })).toEqual({ kind: 'restart' })
    expect(change(pack, { kind: 'one', pack: { ...pack, package: '@mui/joy' } })).toEqual({ kind: 'restart' })
    expect(change(pack, { kind: 'one', pack: { ...pack, scaleKeys: ['gap'] } })).toEqual({ kind: 'restart' })
    const other = { name: 'kit', package: '@acme/kit', folder: 'packs/kit' }
    expect(change(pack, { kind: 'one', pack: other })).toEqual({ kind: 'restart' })
  })

  test('an error gives its message and no restart', () => {
    expect(change(pack, { kind: 'error', message: 'two packs' })).toEqual({ kind: 'error', message: 'two packs' })
  })

  test('a manifest written before the provider waits, and the provider then restarts the server', () => {
    const asked: Pack[] = []
    let written = false
    const hasProvider = (next: Pack) => {
      asked.push(next)
      return written
    }
    expect(packChange(null, { kind: 'one', pack }, root, hasProvider)).toEqual({
      kind: 'wait',
      message: `${noProviderMessage(pack, root)} yet; the dev server restarts when it exists`,
    })
    expect(asked).toEqual([pack])
    written = true
    expect(packChange(null, { kind: 'one', pack }, root, hasProvider)).toEqual({ kind: 'restart' })
  })

  test('the provider is not asked for the same pack or for no pack', () => {
    const none = () => false
    expect(packChange(pack, { kind: 'one', pack }, root, none)).toEqual({ kind: 'same' })
    expect(packChange(pack, { kind: 'none' }, root, none)).toEqual({ kind: 'restart' })
  })
})
