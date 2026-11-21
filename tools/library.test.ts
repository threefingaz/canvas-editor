import { describe, expect, test } from 'vitest'
import { libraryModule, noLibraryFile } from './library.ts'

const root = '/project'
const pack = { name: 'mui', package: '@mui/material', folder: 'packs/mui' }
const exists = () => true

describe('libraryModule', () => {
  test('a pack gives the provider of the pack', () => {
    expect(libraryModule(pack, root, exists)).toEqual({ kind: 'module', path: '/project/packs/mui/library/provider.tsx' })
  })

  test('no pack gives the module of the tool for no library', () => {
    expect(libraryModule(null, root, exists)).toEqual({ kind: 'module', path: `/project/${noLibraryFile}` })
  })

  test('a root with a trailing slash gives the same path', () => {
    expect(libraryModule(null, '/project/', exists)).toEqual({
      kind: 'module',
      path: '/project/src/frame/no-library.tsx',
    })
  })

  test('a pack with no provider gives an error that names the path', () => {
    const checked: string[] = []
    const missing = (path: string) => {
      checked.push(path)
      return false
    }
    expect(libraryModule(pack, root, missing)).toEqual({
      kind: 'error',
      message: 'the pack packs/mui has no library/provider.tsx: /project/packs/mui/library/provider.tsx does not exist',
    })
    expect(checked).toEqual(['/project/packs/mui/library/provider.tsx'])
  })

  test('no pack does not check a file', () => {
    expect(libraryModule(null, root, () => false).kind).toBe('module')
  })
})
