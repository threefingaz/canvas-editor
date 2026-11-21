// Reads the screen files: the `meta` object of each file and the entry that
// the editor gets from the virtual module `virtual:canvas-screens`.
//
// The editor must not import a screen file, because that brings the code of
// the library into the editor document. Thus this module reads `meta` with a
// parser, not with an import, and the rules for `meta` are strict: an object
// literal with a text `title` and a `width` from the config.

import { parseSync } from 'vite'
import { config } from '../canvas.config.ts'
import { messageOf } from '../src/tokens/format.ts'
import type { Pack } from './pack.ts'

export type ScreenMeta = { title: string; width: number }

export type ScreenEntry = {
  // The path in the screens folder with no extension: 'onboarding/welcome'.
  id: string
  // The folders of the path: 'onboarding'; '' for a file directly in the folder.
  flow: string
  // The file name with no extension: 'welcome'.
  name: string
  title: string
  width: number
  // The path relative to the project root: 'screens/onboarding/welcome.tsx'.
  file: string
  // The error text when the file cannot be read; then `title` is the name and
  // `width` is the first width of the config.
  error?: string
}

export type ScreenFile = { file: string; code: string }

// The extension of a screen file: each file with it in the screens folder is a
// screen. The globs in `src/frame/main.tsx` and `src/site/ScreenPage.tsx` are
// literals with the same rule.
export const screenExtension = '.tsx'

// A folder path with one `/` at the end, to test with `startsWith`.
export function folderPrefix(folder: string): string {
  return `${folder.replace(/\/+$/, '')}/`
}

type Node = { type: string; [key: string]: unknown }

function fail(file: string, message: string): never {
  throw new Error(`${file}: ${message}`)
}

// The init of `export const meta = …`, or undefined.
function exportedMeta(body: Node[]): Node | undefined {
  for (const statement of body) {
    if (statement.type !== 'ExportNamedDeclaration') continue
    const declaration = statement.declaration as Node | null
    if (declaration?.type !== 'VariableDeclaration') continue
    for (const declarator of declaration.declarations as Node[]) {
      const id = declarator.id as Node
      if (id.type === 'Identifier' && id.name === 'meta') return (declarator.init as Node | null) ?? undefined
    }
  }
  return undefined
}

// `{ … } as const` and `{ … } satisfies T` are still an object literal.
function unwrap(node: Node): Node {
  if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression') {
    return unwrap(node.expression as Node)
  }
  return node
}

function propertyName(property: Node): string | undefined {
  if (property.computed) return undefined
  const key = property.key as Node
  if (key.type === 'Identifier') return key.name as string
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value
  return undefined
}

export function readScreenMeta(
  code: string,
  file: string,
  widths: readonly number[] = config.widths,
): ScreenMeta {
  const result = parseSync(file, code)
  if (result.errors.length > 0) fail(file, result.errors[0].message)

  const init = exportedMeta(result.program.body as unknown as Node[])
  if (!init) fail(file, 'the file does not export `meta`')

  const object = unwrap(init)
  if (object.type !== 'ObjectExpression') fail(file, '`meta` must be an object literal')

  const values = new Map<string, unknown>()
  for (const property of object.properties as Node[]) {
    if (property.type !== 'Property') fail(file, '`meta` must be an object literal')
    const name = propertyName(property)
    const value = property.value as Node
    if (name !== undefined && value.type === 'Literal') values.set(name, value.value)
  }

  const title = values.get('title')
  if (typeof title !== 'string' || title === '') fail(file, '`meta.title` must be a text')

  const width = values.get('width')
  if (typeof width !== 'number' || !widths.includes(width)) {
    fail(file, `\`meta.width\` must be one of ${widths.join(', ')}`)
  }

  return { title, width }
}

// `file` is the path relative to the project root.
export function screenEntry(file: string, meta: ScreenMeta, screensFolder: string = config.screens): ScreenEntry {
  const path = file.replaceAll('\\', '/')
  const prefix = folderPrefix(screensFolder)
  if (!path.startsWith(prefix)) fail(path, `the file is not in \`${prefix}\``)

  const id = path.slice(prefix.length).replace(/\.[^./]+$/, '')
  const slash = id.lastIndexOf('/')
  return {
    id,
    flow: slash === -1 ? '' : id.slice(0, slash),
    name: id.slice(slash + 1),
    title: meta.title,
    width: meta.width,
    file: path,
  }
}

function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0
}

// By flow, then by name. A plain comparison of code points, thus the order
// does not depend on the locale of the machine.
export function sortScreens(screens: readonly ScreenEntry[]): ScreenEntry[] {
  return [...screens].sort((a, b) => compare(a.flow, b.flow) || compare(a.name, b.name))
}

// The list of the virtual module. A file with an error gives an entry with
// the error text, thus one broken screen does not break the editor.
export function screenList(
  files: readonly ScreenFile[],
  widths: readonly number[] = config.widths,
  screensFolder: string = config.screens,
): ScreenEntry[] {
  const entries = files.map(({ file, code }) => {
    try {
      return screenEntry(file, readScreenMeta(code, file, widths), screensFolder)
    } catch (error) {
      const fallback = screenEntry(file, { title: '', width: widths[0] }, screensFolder)
      return { ...fallback, title: fallback.name, error: messageOf(error) }
    }
  })
  return sortScreens(entries)
}

// The library that the editor gets with the list: the name of the pack, or
// null when no library is connected.
export type LibraryInfo = { name: string } | null

export function libraryInfo(pack: Pack | null): LibraryInfo {
  return pack === null ? null : { name: pack.name }
}

// The text of the virtual module `virtual:canvas-screens` (its type is in
// `src/screens.d.ts`).
export function screensModuleCode(screens: readonly ScreenEntry[], library: LibraryInfo): string {
  return [
    `export const screens = ${JSON.stringify(screens, null, 2)}`,
    `export const library = ${JSON.stringify(library)}`,
    '',
  ].join('\n')
}

// The id of a screen file: the path in the screens folder with no extension.
// Each `.tsx` file in the folder is a screen, also one in a sub folder such as
// `parts/`: a shared part with JSX goes outside the folder (a `.ts` part in
// the folder is not a screen). Null for a path outside the folder or with a
// different extension. `path` and `folder` are absolute, with `/` between the
// parts.
export function screenIdOf(path: string, folder: string): string | null {
  return idInFolder(path, folder, screenExtension)
}

// The path of a file in the folder with no extension, or null for a path
// outside the folder or with a different extension. `path` and `folder` are
// absolute, with `/` between the parts.
export function idInFolder(path: string, folder: string, extension: string): string | null {
  const prefix = folderPrefix(folder)
  return path.startsWith(prefix) && path.endsWith(extension) ? path.slice(prefix.length, -extension.length) : null
}

// True for a path in the folder, also in a sub folder: a screen file or a
// shared part in the screens folder, a file of the library folder. `path` and
// `folder` are absolute, with `/` between the parts.
export function inFolder(path: string, folder: string): boolean {
  return path.startsWith(folderPrefix(folder))
}

// A module of the dev server: its file, and the modules that import it.
export type GraphNode = { file: string | null; importers: Iterable<GraphNode> }

// The ids of the screens that a change of `file` changes: the file itself when
// it is a screen, and each screen that imports it, also through other files.
// `modules` are the modules of the file on the dev server; `folder` is the
// absolute path of the screens folder, with `/` between the parts.
export function affectedScreenIds(file: string, modules: Iterable<GraphNode>, folder: string): string[] {
  const idOf = (path: string) => screenIdOf(path, folder)

  const ids = new Set<string>()
  const changed = idOf(file)
  if (changed !== null) ids.add(changed)

  const seen = new Set<GraphNode>()
  const queue = [...modules]
  while (queue.length > 0) {
    const node = queue.pop()!
    if (seen.has(node)) continue
    seen.add(node)
    const id = node.file === null ? null : idOf(node.file)
    if (id !== null) ids.add(id)
    queue.push(...node.importers)
  }
  return [...ids]
}
