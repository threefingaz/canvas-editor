// The parts of a JSX file that the element-to-code step
// (`source-location.ts`), the static facts of a screen (`screen-facts.ts`)
// and the screen actions (`screen-ops.ts`) share: the place of an offset, the
// names of `Fragment`, the module of each import, the literal of each module
// that the file names, and the origin of a tag.

import { posix } from 'node:path'
import { Visitor, type parseSync } from 'vite'
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
// namespace import. A type-only import (`import type`, `{ type Card }`)
// names no value, thus no tag.
export function importSources(program: Program): Map<string, string> {
  const sources = new Map<string, string>()
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.importKind === 'type') continue
    for (const specifier of statement.specifiers ?? []) {
      if (specifier.type === 'ImportSpecifier' && specifier.importKind === 'type') continue
      sources.set(specifier.local.name, statement.source.value)
    }
  }
  return sources
}

// The literal of a module that a file names: the source of an import, of a
// re-export (`export … from`) or of an `import()` with a text. `at` is the
// start of the statement or of the call, `start` and `end` the range of the
// literal with its quotes.
export type ModuleSource = { at: number; start: number; end: number; source: string }

// Each module that the file names with a literal, in the order of the code.
// An `import()` of a computed text is not read.
export function moduleSources(program: Program): ModuleSource[] {
  const found: ModuleSource[] = []
  const add = (at: number, literal: { type: string; start: number; end: number; value?: unknown } | null | undefined) => {
    if (literal?.type !== 'Literal' || typeof literal.value !== 'string') return
    found.push({ at, start: literal.start, end: literal.end, source: literal.value })
  }
  new Visitor({
    ImportDeclaration(node) {
      add(node.start, node.source)
    },
    ExportNamedDeclaration(node) {
      add(node.start, node.source)
    },
    ExportAllDeclaration(node) {
      add(node.start, node.source)
    },
    ImportExpression(node) {
      add(node.start, node.source)
    },
  }).visit(program)
  return found.sort((a, b) => a.start - b.start)
}

// A tag with no dot that starts with a lowercase letter, or has a `-` or a
// `:`, is a plain element, as JSX reads it.
export function isHostTag(tag: string): boolean {
  return !tag.includes('.') && (/^[a-z]/.test(tag) || tag.includes('-') || tag.includes(':'))
}

// The sources of the library (`sources` of the manifest of the pack,
// `librarySources` in `pack.ts`): the npm packages, and the folders of code
// of the host, relative to the project root with `/` between the parts
// (`../src/ui`).
export type LibrarySources = { packages: readonly string[]; folders: readonly string[] }

// True when the module of an import is a source of the library: a package of
// the list or a path below it (`@lib/core/Button`), or a relative import whose
// path is a folder of the list or a path in it. `file` is the screen file,
// relative to the project root. An alias of the bundler of the host
// (`@/components`) is not read.
// The parts of a relative path with `/`, with no `.` part and no empty one
// (a `/` at the end).
const pathParts = (path: string) => posix.normalize(path).split('/').filter((part) => part !== '' && part !== '.')

export function isLibrarySource(source: string, file: string, library: LibrarySources): boolean {
  if (library.packages.some((name) => source === name || source.startsWith(`${name}/`))) return true
  if (!source.startsWith('./') && !source.startsWith('../')) return false
  const path = posix.normalize(posix.join(posix.dirname(file.replaceAll('\\', '/')), source))
  // Both paths are relative to the project root. The path is in a folder
  // when the parts of the folder start it and the next part does not go up:
  // `..` as a folder (the host root above the project) takes `../src/x`, not
  // `../../other/x`; `.` takes each path in the project. A folder that stays
  // absolute (on a different drive of Windows) has no relative import.
  const own = pathParts(path)
  return library.folders.some((folder) => {
    if (/^([A-Za-z]:)?\//.test(folder)) return false
    const base = pathParts(folder)
    return base.every((part, at) => own[at] === part) && own[base.length] !== '..'
  })
}

// The origin of a tag, from the imports of the file. With no library (no
// library is connected), no component is from the library. `file` is the
// screen file, relative to the project root, for an import of a folder.
export function originOf(tag: string, imports: ReadonlyMap<string, string>, library: LibrarySources | null, file: string): Origin {
  if (isHostTag(tag)) return 'host'
  const source = imports.get(tag.split('.')[0])
  if (source === undefined || library === null) return 'local'
  return isLibrarySource(source, file, library) ? 'library' : 'local'
}
