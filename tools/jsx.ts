// The parts of a JSX file that the element-to-code step
// (`source-location.ts`) and the static facts of a screen (`screen-facts.ts`)
// share: the place of an offset, the names of `Fragment`, the module of each
// import, and the origin of a tag.

import type { parseSync } from 'vite'
import type { Origin } from '../src/requests/format.ts'

export type Program = ReturnType<typeof parseSync>['program']

// Line and column of an offset, both 1-based. The column counts UTF-16 code
// units, as the parser does.
export function position(code: string, offset: number): { line: number; column: number } {
  const before = code.slice(0, offset)
  const lineStart = before.lastIndexOf('\n') + 1
  return { line: before.split('\n').length, column: offset - lineStart + 1 }
}

// The local names of `Fragment`: `Fragment`, and `F` from
// `import { Fragment as F } from 'react'`. React warns when a fragment gets a
// prop other than `key` and `children`.
export function fragmentNames(program: Program): Set<string> {
  const names = new Set(['Fragment'])
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.source.value !== 'react') continue
    for (const specifier of statement.specifiers ?? []) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.imported.type === 'Identifier' &&
        specifier.imported.name === 'Fragment'
      ) {
        names.add(specifier.local.name)
      }
    }
  }
  return names
}

// True for the name of a fragment: one of `names`, or a member name that ends
// in `.Fragment`.
export function isFragment(name: string, names: ReadonlySet<string>): boolean {
  return names.has(name) || name.endsWith('.Fragment')
}

// The module of each imported local name: `B` from
// `import { Button as B } from '<package>'`, also a default and a
// namespace import.
export function importSources(program: Program): Map<string, string> {
  const sources = new Map<string, string>()
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') continue
    for (const specifier of statement.specifiers ?? []) {
      sources.set(specifier.local.name, statement.source.value)
    }
  }
  return sources
}

// A tag with no dot that starts with a lowercase letter, or has a `-` or a
// `:`, is a plain element, as JSX reads it.
export function isHostTag(tag: string): boolean {
  return !tag.includes('.') && (/^[a-z]/.test(tag) || tag.includes('-') || tag.includes(':'))
}

// The origin of a tag, from the imports of the file. With no library package
// (no library is connected), no component is from the library.
export function originOf(tag: string, imports: ReadonlyMap<string, string>, libraryPackage: string | null): Origin {
  if (isHostTag(tag)) return 'host'
  const source = imports.get(tag.split('.')[0])
  if (source === undefined || libraryPackage === null) return 'local'
  return source === libraryPackage || source.startsWith(`${libraryPackage}/`) ? 'library' : 'local'
}
