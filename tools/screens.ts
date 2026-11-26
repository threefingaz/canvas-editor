// Reads the screen files: the `meta` object of each file and the entry that
// the editor gets from the virtual module `virtual:canvas-screens`.
//
// The editor must not import a screen file, because that brings the code of
// the library into the editor document. Thus this module reads `meta` with a
// parser, not with an import, and the rules for `meta` are strict: an object
// literal with a text `title` and a `width` from the config.

import { parseSync } from 'vite'
import { config } from '../canvas.config.ts'
import { relationOf } from '../src/related/groups.ts'
import { messageOf } from '../src/tokens/format.ts'
import { flowOrders, orderScreens, type FlowError, type FlowFile } from './flow.ts'
import type { LibrarySources } from './jsx.ts'
import { levelOf, type Level, type Pack } from './pack.ts'
import { partFacts, partOf, type PartFacts } from './part.ts'
import { linkIds, screenFacts, type TextRange } from './screen-facts.ts'

// `stateOf` and `optionOf` are the id of the base screen of a state or of an
// option. A file has at most one of them; a screen with neither is a base.
export type ScreenMeta = { title: string; width: number; stateOf?: string; optionOf?: string }

// The two fields of `meta` that relate a screen to its base.
const relationFields = ['stateOf', 'optionOf'] as const
type RelationField = (typeof relationFields)[number]

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
  // The id of the base screen when this screen is a state of it.
  stateOf?: string
  // The id of the base screen when this screen is an option of it.
  optionOf?: string
  // The cause when the relation breaks a rule of the list (an unknown base, a
  // chain). The screen is valid: the entry then has no relation fields and is a
  // base screen.
  relationError?: string
  // The place of the part of an option of one element, as `<line>:<column>`
  // of the `<` of its JSX element (the numbers of the location of that
  // element): the block after the marker `canvas-part` (`part.ts`). The canvas
  // shows the frame of such an option cropped to that block.
  part?: string
  // The cause when the marker of the part breaks a rule (more than one
  // marker, no JSX element after it, a screen that is not an option). The
  // entry then has no `part`, and the whole screen shows.
  partError?: string
  // The error text when the file cannot be read; then `title` is the name and
  // `width` is the first width of the config.
  error?: string
  // The ids of the screens that the file links to with a literal address
  // (`href="#/<id>"`), in the order of the code, each one time. An id that no
  // screen has is in it too.
  links: string[]
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

// The object literal of `meta`. Throws for a syntax error, a file with no
// `meta`, and a `meta` that is not an object literal.
function metaObject(code: string, file: string): Node {
  const result = parseSync(file, code)
  if (result.errors.length > 0) fail(file, result.errors[0].message)

  const init = exportedMeta(result.program.body as unknown as Node[])
  if (!init) fail(file, 'the file does not export `meta`')

  const object = unwrap(init)
  if (object.type !== 'ObjectExpression') fail(file, '`meta` must be an object literal')
  return object
}

// The fields of `meta` whose text literal the screen actions replace.
export const metaTextFields = ['title', 'stateOf', 'optionOf'] as const
export type MetaTextField = (typeof metaTextFields)[number]

// A text literal of `meta`: its range with its quotes, and its text.
export type MetaLiteral = TextRange & { value: string }

// The literal of `title`, `stateOf` and `optionOf` in `meta`, for each field
// that the file writes as a text literal. Throws as `readScreenMeta` does for
// a file with no valid `meta`.
export function metaRanges(code: string, file: string): Partial<Record<MetaTextField, MetaLiteral>> {
  const ranges: Partial<Record<MetaTextField, MetaLiteral>> = {}
  for (const property of metaObject(code, file).properties as Node[]) {
    if (property.type !== 'Property') continue
    const name = propertyName(property)
    const value = property.value as Node & { start: number; end: number }
    if (!(metaTextFields as readonly string[]).includes(name ?? '')) continue
    if (value.type === 'Literal' && typeof value.value === 'string') {
      ranges[name as MetaTextField] = { start: value.start, end: value.end, value: value.value }
    }
  }
  return ranges
}

export function readScreenMeta(
  code: string,
  file: string,
  widths: readonly number[] = config.widths,
): ScreenMeta {
  const object = metaObject(code, file)

  const values = new Map<string, unknown>()
  const names = new Set<string>()
  for (const property of object.properties as Node[]) {
    if (property.type !== 'Property') fail(file, '`meta` must be an object literal')
    const name = propertyName(property)
    const value = property.value as Node
    if (name !== undefined) names.add(name)
    // A later property of the same name wins, as in the object: one that is
    // not a literal leaves no value.
    if (name !== undefined && value.type === 'Literal') values.set(name, value.value)
    else if (name !== undefined) values.delete(name)
  }

  const title = values.get('title')
  if (typeof title !== 'string' || title === '') fail(file, '`meta.title` must be a text')

  const width = values.get('width')
  if (typeof width !== 'number' || !widths.includes(width)) {
    fail(file, `\`meta.width\` must be one of ${widths.join(', ')}`)
  }

  const meta: ScreenMeta = { title, width }
  for (const field of relationFields) {
    if (!names.has(field)) continue
    const value = values.get(field)
    if (typeof value !== 'string' || value === '') fail(file, `\`meta.${field}\` must be a screen id`)
    meta[field] = value
  }
  if (meta.stateOf !== undefined && meta.optionOf !== undefined) {
    fail(file, '`meta` can have `stateOf` or `optionOf`, not the two')
  }
  return meta
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
    ...(meta.stateOf === undefined ? {} : { stateOf: meta.stateOf }),
    ...(meta.optionOf === undefined ? {} : { optionOf: meta.optionOf }),
    links: [],
  }
}

// The relations that break a rule of the list: a map from the id of a screen
// to the cause. The base of a state is a base screen in the same flow; the
// base of an option is a base screen or a state in the same flow. The rules
// read the fields as the files write them, in one pass: a base whose own
// relation is broken still counts as what its file says, and the cause then
// names that broken relation too, because the canvas shows that base as a
// base screen. A base whose file has an error has no relation fields, thus it
// is a valid base.
export function relationProblems(entries: readonly ScreenEntry[]): Map<string, string> {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const problems = new Map<string, string>()
  // The screens whose cause is the relation of their base: id to base id.
  const byBase = new Map<string, string>()
  for (const entry of entries) {
    const relation = relationOf(entry)
    if (relation === 'base') continue
    const field: RelationField = relation === 'state' ? 'stateOf' : 'optionOf'
    const baseId = entry[field]!
    const name = `\`${field}\``
    const base = byId.get(baseId)
    let problem: string | null = null
    if (baseId === entry.id) problem = `${name} names the screen itself`
    else if (base === undefined) problem = `${name}: no screen has the id '${baseId}'`
    else if (base.flow !== entry.flow) problem = `${name}: the screen '${baseId}' is in a different flow`
    else if (field === 'stateOf' && base.stateOf !== undefined) {
      problem = `${name}: the screen '${baseId}' is a state; a state has no states`
    } else if (base.optionOf !== undefined) {
      problem = field === 'stateOf'
        ? `${name}: the screen '${baseId}' is an option; an option has no states`
        : `${name}: the screen '${baseId}' is an option; an option has no options`
    }
    if (problem === null) continue
    problems.set(entry.id, problem)
    if (base !== undefined && baseId !== entry.id && base.flow === entry.flow) byBase.set(entry.id, baseId)
  }
  for (const [id, baseId] of byBase) {
    if (problems.has(baseId)) {
      problems.set(id, `${problems.get(id)} (its own relation is broken, thus it shows as a base screen)`)
    }
  }
  return problems
}

// The entry with the cause of its broken relation and with no relation
// fields, thus a base screen.
function withRelationError(entry: ScreenEntry, problem: string): ScreenEntry {
  const { stateOf: _stateOf, optionOf: _optionOf, ...rest } = entry
  return { ...rest, relationError: problem }
}

// The list of the virtual module. A file with an error gives an entry with
// the error text, thus one broken screen does not break the editor. A broken
// relation gives an entry with `relationError`, not an error: the screen
// stays visible. An option with the marker of its part gets `part`, and a
// marker that breaks a rule gives `partError` (`partOf`); a screen with a
// broken relation gets neither, because its relation is the finding.
// `library` is the sources of the library, or null with no
// library; the links of a file do not depend on it. The list is in
// the sequence of `orderScreens`: by flow, then by the `flow.json` of each flow
// (`flowFiles`; a file that is not valid counts as no file), then by name.
export function screenList(
  files: readonly ScreenFile[],
  widths: readonly number[] = config.widths,
  screensFolder: string = config.screens,
  library: LibrarySources | null = null,
  flowFiles: readonly FlowFile[] = [],
): ScreenEntry[] {
  const parts = new Map<string, PartFacts>()
  const entries = files.map(({ file, code }) => {
    try {
      const entry = screenEntry(file, readScreenMeta(code, file, widths), screensFolder)
      const links = linkIds(screenFacts(code, file, library))
      parts.set(entry.id, partFacts(code, file))
      return { ...entry, links }
    } catch (error) {
      const fallback = screenEntry(file, { title: '', width: widths[0] }, screensFolder)
      return { ...fallback, title: fallback.name, error: messageOf(error) }
    }
  })
  const problems = relationProblems(entries)
  return orderScreens(
    entries.map((entry) => {
      const problem = problems.get(entry.id)
      if (problem !== undefined) return withRelationError(entry, problem)
      const facts = parts.get(entry.id)
      if (facts === undefined) return entry
      const { part, problem: partError } = partOf(facts, entry.optionOf !== undefined)
      return {
        ...entry,
        ...(part === undefined ? {} : { part }),
        ...(partError === undefined ? {} : { partError }),
      }
    }),
    flowOrders(flowFiles),
  )
}

// The library that the editor gets with the list: the name of the pack and
// its level (`levelOf`), or null when no library is connected. `tokens` are
// the tokens of the token file of the project, or null when it has no file or
// a file that is not valid.
export type LibraryInfo = { name: string; level: Exclude<Level, 'none'> } | null

export function libraryInfo(pack: Pack | null, tokens: readonly unknown[] | null = null): LibraryInfo {
  const level = levelOf(pack, tokens === null ? null : tokens.length)
  return pack === null || level === 'none' ? null : { name: pack.name, level }
}

// The settings of the project that the editor needs: the widths of a frame
// (`widths` of the `canvas.config.ts` of the project), and the path of the
// guide of the project relative to the folder where the agent works, which
// the fixed sentence names (`AGENTS.md`, `canvas/AGENTS.md`).
export type ProjectInfo = { widths: readonly number[]; guide: string }

export const toolProject: ProjectInfo = { widths: config.widths, guide: 'AGENTS.md' }

// The text of the virtual module `virtual:canvas-screens` (its type is in
// `src/screens.d.ts`). `flowErrors` are the `flow.json` files that are not
// valid: the canvas shows each one at the name of its row.
export function screensModuleCode(
  screens: readonly ScreenEntry[],
  library: LibraryInfo,
  flowErrors: readonly FlowError[] = [],
  project: ProjectInfo = toolProject,
): string {
  return [
    `export const screens = ${JSON.stringify(screens, null, 2)}`,
    `export const library = ${JSON.stringify(library)}`,
    `export const flowErrors = ${JSON.stringify(flowErrors)}`,
    `export const project = ${JSON.stringify(project)}`,
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
