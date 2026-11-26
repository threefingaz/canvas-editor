import { parseSync } from 'vite'
import { describe, expect, test } from 'vitest'
import { importSources, isLibrarySource, originOf } from './jsx.ts'

const library = { packages: ['@acme/kit'], folders: ['../src/ui'] }

describe('isLibrarySource', () => {
  test('a package of the library and a path below it', () => {
    expect(isLibrarySource('@acme/kit', 'screens/a/b.tsx', library)).toBe(true)
    expect(isLibrarySource('@acme/kit/Button', 'screens/a/b.tsx', library)).toBe(true)
  })

  test('a package whose name only starts with the name of the library is not the library', () => {
    expect(isLibrarySource('@acme/kit-extra', 'screens/a/b.tsx', library)).toBe(false)
    expect(isLibrarySource('@acme/kits', 'screens/a/b.tsx', library)).toBe(false)
  })

  test('a relative import into a folder of the library, and not into a folder next to it', () => {
    expect(isLibrarySource('../../../src/ui/Button.tsx', 'screens/a/b.tsx', library)).toBe(true)
    expect(isLibrarySource('../../../src/ui', 'screens/a/b.tsx', library)).toBe(true)
    expect(isLibrarySource('../../../src/ui-extra/Button.tsx', 'screens/a/b.tsx', library)).toBe(false)
    expect(isLibrarySource('../../components/Ring.tsx', 'screens/a/b.tsx', library)).toBe(false)
  })

  test('a folder that is the project root takes each relative import in the project', () => {
    const root = { packages: [], folders: ['.'] }
    expect(isLibrarySource('../../ui/Button.tsx', 'screens/a/b.tsx', root)).toBe(true)
    expect(isLibrarySource('./Row.tsx', 'screens/a/b.tsx', root)).toBe(true)
    expect(isLibrarySource('../../../src/Button.tsx', 'screens/a/b.tsx', root)).toBe(false)
  })

  test('a folder above the project takes no path above that folder', () => {
    const host = { packages: [], folders: ['..'] }
    expect(isLibrarySource('../../../src/Button.tsx', 'screens/a/b.tsx', host)).toBe(true)
    expect(isLibrarySource('../../../../other/Evil.tsx', 'screens/a/b.tsx', host)).toBe(false)
    const two = { packages: [], folders: ['../..'] }
    expect(isLibrarySource('../../../../x/Button.tsx', 'screens/a/b.tsx', two)).toBe(true)
    expect(isLibrarySource('../../../../../x/Button.tsx', 'screens/a/b.tsx', two)).toBe(false)
  })

  test('a folder with a slash at the end, and a folder on a different drive', () => {
    expect(isLibrarySource('../../../src/ui/Button.tsx', 'screens/a/b.tsx', { packages: [], folders: ['../src/ui/'] })).toBe(true)
    expect(isLibrarySource('../../../src/ui/Button.tsx', 'screens/a/b.tsx', { packages: [], folders: ['D:/src/ui'] })).toBe(false)
  })
})

describe('originOf', () => {
  const imports = new Map([
    ['Button', '@acme/kit'],
    ['Ring', '../../components/Ring.tsx'],
  ])

  test('a plain element is host; an import of the library is library; each other import is local', () => {
    expect(originOf('div', imports, library, 'screens/a/b.tsx')).toBe('host')
    expect(originOf('Button', imports, library, 'screens/a/b.tsx')).toBe('library')
    expect(originOf('Ring', imports, library, 'screens/a/b.tsx')).toBe('local')
    expect(originOf('Unknown', imports, library, 'screens/a/b.tsx')).toBe('local')
  })

  test('with no library, no element is library', () => {
    expect(originOf('Button', imports, null, 'screens/a/b.tsx')).toBe('local')
  })
})

describe('importSources', () => {
  test('leaves out a type-only import', () => {
    const code = [
      "import type { Card } from '@acme/kit'",
      "import { type Row, Button } from '@acme/kit'",
      "import { Box } from '@acme/kit'",
    ].join('\n')
    const { program } = parseSync('a.tsx', code)
    expect([...importSources(program)]).toEqual([
      ['Button', '@acme/kit'],
      ['Box', '@acme/kit'],
    ])
  })
})
