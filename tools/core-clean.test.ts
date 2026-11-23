import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { declaredPackages, htmlPackImports, packageOf, packImports } from './core-clean.ts'

// The packages that the root `package.json` of the fixtures declares.
const declared = ['react', 'react-dom', 'vite', '@base/ui']

describe('packageOf', () => {
  test('gives the package of a bare module text', () => {
    expect(packageOf('react')).toBe('react')
    expect(packageOf('react-dom/client')).toBe('react-dom')
    expect(packageOf('@lib/core')).toBe('@lib/core')
    expect(packageOf('@lib/core/Stack')).toBe('@lib/core')
  })

  test('gives null for a path, a scheme and a subpath import', () => {
    for (const source of ['./a.ts', '../a.ts', '/src/a.ts', 'node:fs', 'virtual:canvas-library', '#internal', 'https://x.org/a.js']) {
      expect(packageOf(source)).toBeNull()
    }
  })
})

describe('packImports', () => {
  test('finds an import of a package that the root does not declare, with its line', () => {
    const code = `import { useState } from 'react'\nimport { Button } from '@lib/core'\n`
    expect(packImports(code, 'a.tsx', declared)).toEqual([{ line: 2, source: '@lib/core', kind: 'package' }])
  })

  test('finds a package that a pack brings with it and that the root does not declare', () => {
    const code = `import { styled } from '@lib/system'\nimport { Transition } from 'lib-transition'\n`
    expect(packImports(code, 'a.ts', declared).map((item) => item.source)).toEqual(['@lib/system', 'lib-transition'])
  })

  test('a package that the root declares is allowed, also when a pack lists it too', () => {
    const code = `import { createRoot } from 'react-dom/client'\nimport { Box } from '@base/ui/Box'\nimport { defineConfig } from 'vite'\n`
    expect(packImports(code, 'a.ts', declared)).toEqual([])
  })

  test('a Node module, a virtual module and a relative path are allowed', () => {
    const code = [
      `import { join } from 'node:path'`,
      `import { readFileSync } from 'fs'`,
      `import { LibraryProvider } from 'virtual:canvas-library'`,
      `import { a } from './a.ts'`,
    ].join('\n')
    expect(packImports(code, 'a.ts', declared)).toEqual([])
  })

  test('finds an import of a path below the package, and a side-effect import', () => {
    const code = `import Stack from '@lib/core/Stack'\nimport 'lib-styles/reset.css'\n`
    expect(packImports(code, 'a.ts', declared)).toEqual([
      { line: 1, source: '@lib/core/Stack', kind: 'package' },
      { line: 2, source: 'lib-styles/reset.css', kind: 'package' },
    ])
  })

  test('finds an import of a path in packs/', () => {
    const code = [
      `import { LibraryProvider } from '../../packs/demo/library/provider.tsx'`,
      `import theme from 'packs/demo/library/theme.ts'`,
      `import x from '/root/packs/demo/a.ts'`,
    ].join('\n')
    expect(packImports(code, 'a.tsx', declared)).toEqual([
      { line: 1, source: '../../packs/demo/library/provider.tsx', kind: 'pack-path' },
      { line: 2, source: 'packs/demo/library/theme.ts', kind: 'pack-path' },
      { line: 3, source: '/root/packs/demo/a.ts', kind: 'pack-path' },
    ])
  })

  test('a folder whose name only ends with packs is not the packs folder', () => {
    const code = `import a from './my-packs/a.ts'\nimport b from './packs.ts'\n`
    expect(packImports(code, 'a.ts', declared)).toEqual([])
  })

  test('finds re-exports, type imports and a dynamic import with a literal source', () => {
    const code = [
      `export { Button } from '@lib/core'`,
      `export * from '../packs/demo/library/tokens.ts'`,
      `import type { Theme } from '@lib/core/styles'`,
      `type T = import('@lib/core').Theme`,
      `const m = await import('@lib/core/Card')`,
      'const n = await import(`lib-styles`)',
    ].join('\n')
    expect(packImports(code, 'a.ts', declared).map((item) => item.line)).toEqual([1, 2, 3, 4, 5, 6])
  })

  test('finds require, import-require and import.meta.glob with literal sources', () => {
    const code = [
      `const a = require('@lib/core')`,
      `import b = require('../packs/demo/a.ts')`,
      `const c = import.meta.glob('../../packs/*/library/*.tsx')`,
      `const d = import.meta.glob(['./screens/**/*.tsx', '!../packs/**/*.test.tsx'])`,
      `const e = import.meta.glob('./screens/**/*.tsx')`,
    ].join('\n')
    expect(packImports(code, 'a.ts', declared)).toEqual([
      { line: 1, source: '@lib/core', kind: 'package' },
      { line: 2, source: '../packs/demo/a.ts', kind: 'pack-path' },
      { line: 3, source: '../../packs/*/library/*.tsx', kind: 'pack-path' },
      { line: 4, source: '!../packs/**/*.test.tsx', kind: 'pack-path' },
    ])
  })

  test('a call of another function with a module text does not count', () => {
    const code = `const a = load('@lib/core')\nconst b = other.glob('../packs/a.ts')\n`
    expect(packImports(code, 'a.ts', declared)).toEqual([])
  })

  test('a computed source cannot be read and does not count', () => {
    const code = `const m = await import(pathToFileURL(path).href)\nconst r = require(name)\n`
    expect(packImports(code, 'a.ts', declared)).toEqual([])
  })

  test('a name in a comment or in a string that is not an import does not count', () => {
    const code = [
      `// import { Button } from '@lib/core'`,
      `/* the pack is in packs/demo/library/provider.tsx */`,
      `const name = '@lib/core'`,
      `const path = '../packs/demo/library/tokens.ts'`,
      'const text = `import x from "@lib/core"`',
    ].join('\n')
    expect(packImports(code, 'a.ts', declared)).toEqual([])
  })

  test('throws for a file that does not parse', () => {
    expect(() => packImports('import {', 'broken.ts', declared)).toThrow('broken.ts')
  })
})

describe('htmlPackImports', () => {
  test('finds a script or a link of a path in packs/ or of a package that is not declared', () => {
    const html = [
      '<link rel="icon" href="/favicon.svg" />',
      '<script type="module" src="/src/editor/main.tsx"></script>',
      "<script type='module' src='/packs/demo/library/provider.tsx'></script>",
      '<link rel="stylesheet" href="@lib/core/styles.css" />',
      '<link rel="stylesheet" href="https://fonts.example.org/a.css" />',
    ].join('\n')
    expect(htmlPackImports(html, declared)).toEqual([
      { line: 3, source: '/packs/demo/library/provider.tsx', kind: 'pack-path' },
      { line: 4, source: '@lib/core/styles.css', kind: 'package' },
    ])
  })
})

describe('declaredPackages', () => {
  test('gives the name of the tool and each package that the file lists', () => {
    const text = JSON.stringify({
      name: 'canvas-editor',
      dependencies: { react: '^19.0.0' },
      devDependencies: { vite: '^8.0.0' },
      peerDependencies: { 'lib-styles': '^2.0.0' },
      optionalDependencies: { '@lib/extra': '^1.0.0' },
    })
    expect(declaredPackages(text)).toEqual(['@lib/extra', 'canvas-editor', 'lib-styles', 'react', 'vite'])
  })

  test('gives nothing for a file with no packages', () => {
    expect(declaredPackages('{}')).toEqual([])
  })

  test('throws for a file that is not valid JSON', () => {
    expect(() => declaredPackages('{')).toThrow()
  })
})

// The check of the repository: each code file of the core, its tests too (the
// export keeps them), the command in `bin/`, the root config files and the
// HTML entries.
const root = fileURLToPath(new URL('..', import.meta.url))
const coreFolders = ['src', 'tools', 'bin']
const rootFiles = ['vite.config.ts', 'vitest.config.ts', 'canvas.config.ts']
const htmlFiles = ['index.html', 'frame.html', 'site.html']

function codeFiles(folder: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) files.push(...codeFiles(path))
    else if (/\.(ts|tsx|js)$/.test(entry.name)) files.push(path)
  }
  return files
}

describe('the core of the tool', () => {
  const names = declaredPackages(readFileSync(join(root, 'package.json'), 'utf8'))
  const fileOf = (path: string) => relative(root, path).replaceAll('\\', '/')
  const line = (file: string) => (item: { line: number; source: string; kind: string }) =>
    `${file}:${item.line} imports '${item.source}' (${item.kind})`

  test('imports no path in packs/ and no package that the root does not declare', () => {
    const files = [
      ...coreFolders.flatMap((folder) => codeFiles(join(root, folder))),
      ...rootFiles.map((file) => join(root, file)).filter((file) => existsSync(file)),
    ]
    expect(files.some((file) => file.endsWith('.test.ts'))).toBe(true)
    const found = files.flatMap((path) => {
      const file = fileOf(path)
      return packImports(readFileSync(path, 'utf8'), file, names).map(line(file))
    })
    expect(found).toEqual([])
  })

  test('the HTML entries load no path in packs/ and no package that the root does not declare', () => {
    const found = htmlFiles.flatMap((file) => htmlPackImports(readFileSync(join(root, file), 'utf8'), names).map(line(file)))
    expect(found).toEqual([])
  })
})
