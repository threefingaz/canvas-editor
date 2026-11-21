// The element-to-code step: adds
// `data-loc-<line>-<column>={"<file>:<line>:<column> <Tag> <origin>"}` as the
// last attribute of each JSX element of a screen file, for host elements
// (`<div>`) and for components (`<Button>`). The editor reads it from the props
// that React keeps for each element, thus a component does not have to pass it
// on to the DOM.
//
// `<Tag>` is the tag name as the file writes it (`Stack`, `Card.Header`,
// `div`). `<origin>` is `library` for a name imported from the library package
// or from a sub path of it, `host` for a plain element (a lowercase tag), and
// `local` for each other component: one of the file, or one imported from a
// different module. A member name (`Card.Header`) takes the origin of its first
// part. The editor reads the value from the end (see `parseLoc` in
// `src/editor/locate/fiber.ts`), thus a space in the file name is kept.
//
// Each element has its own attribute name, not one shared name: a wrapper that
// clones its child with its own leftover props (a transition of the library)
// gives the child its own location attribute too, and a shared name would
// replace the location of the child. With one name per element the child
// keeps both, and the editor takes as its location the one that its parent
// does not have (see `src/editor/locate/fiber.ts`).
//
// Line and column are 1-based and point to the `<` of the opening tag in the
// file on disk; the column counts UTF-16 code units, as the parser does. The
// value is a JS string in an expression, not a JSX string, thus a quote or an
// `&` in the file name is kept as it is. The change is written with
// `magic-string`, thus the source map stays correct.

import MagicString, { type SourceMap } from 'magic-string'
import { parseSync, Visitor } from 'vite'
import type { Origin } from '../src/requests/format.ts'
import { folderPrefix, screenExtension } from './screens.ts'

// The start of the name of each location attribute.
export const locationPrefix = 'data-loc-'

export type SourceLocationResult = { code: string; map: SourceMap }

// The path relative to the project root of a module that gets the locations:
// a screen file, with the same extension rule as the list of screens. Null
// for another module, and for a module id with a query (`?import`, `?raw`),
// which is a different module. `id` and `root` are absolute; `\` is read as `/`.
export function screenModuleFile(id: string, root: string, folder: string): string | null {
  if (id.includes('?') || !id.endsWith(screenExtension)) return null
  const base = folderPrefix(root.replaceAll('\\', '/'))
  const path = id.replaceAll('\\', '/')
  if (!path.startsWith(base)) return null
  const file = path.slice(base.length)
  return file.startsWith(folderPrefix(folder)) ? file : null
}

// Line and column of an offset, both 1-based.
function position(code: string, offset: number): { line: number; column: number } {
  const before = code.slice(0, offset)
  const lineStart = before.lastIndexOf('\n') + 1
  return { line: before.split('\n').length, column: offset - lineStart + 1 }
}

type Program = ReturnType<typeof parseSync>['program']

// The local names of `Fragment`: `Fragment`, and `F` from
// `import { Fragment as F } from 'react'`. React warns when a fragment gets a
// prop other than `key` and `children`.
function fragmentNames(program: Program): Set<string> {
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

// The module of each imported local name: `B` from
// `import { Button as B } from '<package>'`, also a default and a
// namespace import.
function importSources(program: Program): Map<string, string> {
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
function isHostTag(tag: string): boolean {
  return !tag.includes('.') && (/^[a-z]/.test(tag) || tag.includes('-') || tag.includes(':'))
}

// The origin of a tag, from the imports of the file. With no library package
// (no library is connected), no component is from the library.
function originOf(tag: string, imports: Map<string, string>, libraryPackage: string | null): Origin {
  if (isHostTag(tag)) return 'host'
  const source = imports.get(tag.split('.')[0])
  if (source === undefined || libraryPackage === null) return 'local'
  return source === libraryPackage || source.startsWith(`${libraryPackage}/`) ? 'library' : 'local'
}

// Gives null when nothing changes: a file with no JSX, a file where each
// element is a fragment or has a location attribute, or code with a syntax error (the
// main transform reports the error). `relativeFile` is the path relative to
// the project root and goes into the attribute; `libraryPackage` is the npm
// package of the library (`package` in the manifest of the pack, `pack.json`),
// or null when no library is connected; `source` names the file in the source
// map.
export function addSourceLocations(
  code: string,
  relativeFile: string,
  libraryPackage: string | null,
  source: string = relativeFile,
): SourceLocationResult | null {
  const { program, errors } = parseSync(relativeFile, code)
  if (errors.length > 0) return null

  const fragments = fragmentNames(program)
  const imports = importSources(program)
  const output = new MagicString(code)
  let changed = false

  new Visitor({
    JSXOpeningElement(node) {
      const name = code.slice(node.name.start, node.name.end)
      if (fragments.has(name) || name.endsWith('.Fragment')) return
      const hasLocation = node.attributes.some(
        (attribute) =>
          attribute.type === 'JSXAttribute' &&
          attribute.name.type === 'JSXIdentifier' &&
          attribute.name.name.startsWith(locationPrefix),
      )
      if (hasLocation) return

      // After all other attributes and spreads, thus this value wins over an
      // attribute of the same name that comes in with `{...props}`. With no
      // attribute: after the name and the type argument.
      const last = node.attributes.at(-1) ?? node.typeArguments ?? node.name
      const insertAt = last.end
      const { line, column } = position(code, node.start)
      // A member name can have spaces around its dots.
      const tag = name.replaceAll(/\s+/g, '')
      const origin = originOf(tag, imports, libraryPackage)
      const value = JSON.stringify(`${relativeFile}:${line}:${column} ${tag} ${origin}`)
      output.appendLeft(insertAt, ` ${locationPrefix}${line}-${column}={${value}}`)
      changed = true
    },
  }).visit(program)

  if (!changed) return null
  return { code: output.toString(), map: output.generateMap({ hires: 'boundary', source }) }
}
