// The screen actions of the canvas: move a screen in its row, change its
// title, rename it (also into a different flow), delete it into the trash,
// and restore it from the trash.
//
// The tool changes `screens/` only when the result is fully given by the
// action: it moves whole files, writes `flow.json`, and replaces text literals
// that the parser found (the address of a link, `stateOf`, `optionOf`, the
// `title` of `meta`). It never writes markup. A link that the code computes is
// not found: after a rename or a delete it shows as a `broken-link` issue.
//
// Each action is a plan first: the functions `plan…` read the files through a
// `Reader` and change nothing. A plan has the text of each file that it read,
// the moves, the writes, the files to remove, and the refusals. `applyPlan`
// reads each file again and stops with no change when one differs (an agent
// wrote it in between); then it does the moves, the writes and the removes,
// and puts back what it did when a step fails.
//
// Each path is relative to the project root, with `/` between the parts.

import { mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import MagicString from 'magic-string'
import { config } from '../canvas.config.ts'
import { screenHash } from '../src/frame/screen-link.ts'
import { groupMembers } from '../src/related/groups.ts'
import { flowOfId, flowProblem, idOf, memberName, nameOfId, nameProblem } from '../src/related/names.ts'
import type { IdChange, TrashItem } from '../src/requests/api.ts'
import { fileText, parseIssues, parseRequest, type IssuesFile, type RequestFile, type Target } from '../src/requests/format.ts'
import { messageOf } from '../src/tokens/format.ts'
import { flowFileName, movedOrder, parseFlow, type FlowFile } from './flow.ts'
import { readText } from './project.ts'
import { tempName } from './requests.ts'
import { screenFacts, type TextRange } from './screen-facts.ts'
import { folderPrefix, metaRanges, screenExtension, screenList, type ScreenEntry } from './screens.ts'

// Each plan takes the widths of a frame of the project (`widths` of its
// config): a screen with a different width is a file with an error. The
// folders (`screens`, `work`) are the fixed ones of the config of the tool.
type Widths = readonly number[]

// The folder of the trash in the work folder.
export const trashName = 'trash'

// The file of a deleted screen that says what the trash folder has.
export const manifestName = 'manifest.json'

// Reads the files of a project. `read` gives the text of a file, or null when
// there is no file. `list` gives each file below a folder, also in its sub
// folders, as a path relative to the project root; an empty list for a folder
// that does not exist.
export type Reader = {
  read(path: string): string | null
  list(folder: string): string[]
}

// A file that the plan read: its text then, or null when there was no file.
export type FileRead = { path: string; text: string | null }

export type PlanAction = 'reorder' | 'title' | 'rename' | 'delete' | 'restore'

export type Plan = {
  action: PlanAction
  // The screen of the action: its id, or for a restore the id in the manifest.
  screen: string
  // The screens whose id changes, the screen of the action first.
  screens: IdChange[]
  // For a delete: the screens outside the deleted ones that link to one of
  // them, by a literal address. Each such link is then a `broken-link` issue.
  linkedBy: string[]
  reads: FileRead[]
  moves: { from: string; to: string }[]
  // The new text of each file, at its path after the moves.
  writes: { path: string; text: string }[]
  removes: string[]
  // Why the action cannot run. A plan with a refusal changes nothing.
  refusals: string[]
}

// The trash folder of a deleted screen: the files with their paths below the
// project, and this manifest. `flowOrder` is the `order` of the `flow.json` of
// its flow before the delete, when the file named the screen; else null.
export type TrashManifest = { screen: string; files: string[]; flowOrder: string[] | null; time: string }

// A Reader of the folder `root` on the disk.
export function diskReader(root: string): Reader {
  return {
    read: (path) => readText(join(root, path)),
    list(folder) {
      let names: string[]
      try {
        names = readdirSync(join(root, folder), { recursive: true, encoding: 'utf8' })
      } catch {
        return []
      }
      return names
        .map((name) => `${folderPrefix(folder)}${name.replaceAll('\\', '/')}`)
        .filter((path) => statSync(join(root, path)).isFile())
    },
  }
}

function screenPath(id: string): string {
  return `${folderPrefix(config.screens)}${id}${screenExtension}`
}

function workFolder(kind: 'requests' | 'issues'): string {
  return `${folderPrefix(config.work)}${kind}`
}

function workFile(kind: 'requests' | 'issues', id: string): string {
  return `${workFolder(kind)}/${id}.json`
}

function flowPath(flow: string): string {
  return `${folderPrefix(config.screens)}${flow === '' ? '' : `${flow}/`}${flowFileName}`
}

// True when two paths differ only in the case of their letters: on a file
// system that ignores the case (macOS, Windows) they are the same file.
function caseOnly(a: string, b: string): boolean {
  return a !== b && a.toLowerCase() === b.toLowerCase()
}

function isBase(entry: ScreenEntry): boolean {
  return entry.stateOf === undefined && entry.optionOf === undefined
}

// A text literal that names a screen: the address of a link (`link`), or
// `stateOf` and `optionOf` of `meta`.
export type IdLiteral = TextRange & { id: string; link: boolean }

// The literals of a screen file that name a screen. A file that the parser
// cannot read has none.
export function idLiterals(code: string, file: string): IdLiteral[] {
  try {
    const links = screenFacts(code, file, null).links.map((link) => ({ ...link.range, id: link.id, link: true }))
    const ranges = metaRanges(code, file)
    const relations = [ranges.stateOf, ranges.optionOf].flatMap((range) =>
      range === undefined ? [] : [{ start: range.start, end: range.end, id: range.value, link: false }],
    )
    return [...links, ...relations]
  } catch {
    return []
  }
}

// The source with each literal whose id `map` names replaced by the new id, in
// the same quotes: a link gets the address of the new id, `stateOf` and
// `optionOf` the id. An id that the map does not name stays, and so does each
// other part of the source.
export function rewriteIds(source: string, literals: readonly IdLiteral[], map: ReadonlyMap<string, string>): string {
  const output = new MagicString(source)
  const done = new Set<number>()
  for (const literal of literals) {
    const next = map.get(literal.id)
    if (next === undefined || next === literal.id || done.has(literal.start)) continue
    done.add(literal.start)
    const quote = source[literal.start]
    output.overwrite(literal.start, literal.end, `${quote}${literal.link ? screenHash(next) : next}${quote}`)
  }
  return output.toString()
}

// A text as a literal in the quotes `quote` (`'` or `"`).
function quoted(text: string, quote: string): string {
  const escaped = text
    .replaceAll('\\', '\\\\')
    .replaceAll(quote, `\\${quote}`)
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
  return `${quote}${escaped}${quote}`
}

// The text of a `flow.json` with a new `order`, with the other keys of the
// file as they were.
function flowText(old: string | null, order: readonly string[]): string {
  const data = old === null ? {} : (JSON.parse(old) as Record<string, unknown>)
  return `${JSON.stringify({ ...data, order }, null, 2)}\n`
}

// What a plan reads: the screens of the project with their code, and the
// `flow.json` files. Each file that it reads is in `reads`.
class Session {
  readonly reads = new Map<string, string | null>()
  readonly entries: ScreenEntry[]
  readonly codes = new Map<string, string>()
  readonly reader: Reader

  constructor(reader: Reader, widths: Widths) {
    this.reader = reader
    const prefix = folderPrefix(config.screens)
    const paths = reader.list(config.screens)
    const files = paths
      .filter((path) => path.endsWith(screenExtension))
      .map((file) => ({ file, code: this.read(file) ?? '' }))
    for (const { file, code } of files) this.codes.set(file, code)
    const flows: FlowFile[] = paths
      .filter((path) => path === `${prefix}${flowFileName}` || path.endsWith(`/${flowFileName}`))
      .map((file) => ({
        flow: file.slice(prefix.length, -flowFileName.length).replace(/\/$/, ''),
        file,
        text: this.read(file) ?? '',
      }))
    this.entries = screenList(files, widths, config.screens, null, flows)
  }

  read(path: string): string | null {
    if (this.reads.has(path)) return this.reads.get(path)!
    const text = this.reader.read(path)
    this.reads.set(path, text)
    return text
  }

  entry(id: string): ScreenEntry | undefined {
    return this.entries.find((entry) => entry.id === id)
  }

  // Records the text of a file that the plan changes, without a read of the
  // reader: `applyPlan` checks it again.
  record(path: string, text: string | null): void {
    this.reads.set(path, text)
  }

  // The states and the options of a screen, and the options of its states.
  group(id: string): ScreenEntry[] {
    return groupMembers(this.entries, id)
  }

  // The names of the base screens of a flow.
  baseNames(flow: string): string[] {
    return this.entries.filter((entry) => entry.flow === flow && isBase(entry)).map((entry) => entry.name)
  }

  // The `order` of the `flow.json` of a flow: null with no file, or an error.
  flowOrder(flow: string): { text: string | null; order: string[] | null; error?: string } {
    const text = this.read(flowPath(flow))
    if (text === null) return { text, order: null }
    const result = parseFlow(text)
    return result.error === undefined ? { text, order: result.order } : { text, order: null, error: result.error }
  }

  plan(action: PlanAction, screen: string, parts: Partial<Plan>): Plan {
    return {
      action,
      screen,
      screens: [],
      linkedBy: [],
      moves: [],
      writes: [],
      removes: [],
      refusals: [],
      ...parts,
      reads: [...this.reads].map(([path, text]) => ({ path, text })),
    }
  }

  refuse(action: PlanAction, screen: string, ...refusals: string[]): Plan {
    return this.plan(action, screen, { refusals })
  }

  // The entry of a screen that the action can change, or the refusal.
  known(action: PlanAction, id: string): ScreenEntry | Plan {
    const entry = this.entry(id)
    if (entry === undefined) return this.refuse(action, id, `no screen has the id '${id}'`)
    if (entry.error !== undefined) return this.refuse(action, id, `the file ${entry.file} has an error; fix it first: ${entry.error}`)
    return entry
  }
}

function isPlan(value: ScreenEntry | Plan): value is Plan {
  return 'refusals' in value
}

// Move a base screen to the position `to` (from 0) among the base screens of
// its row: the new `order` of its `flow.json`.
export function planReorder(reader: Reader, screen: string, to: number, widths: Widths = config.widths): Plan {
  const session = new Session(reader, widths)
  const entry = session.known('reorder', screen)
  if (isPlan(entry)) return entry
  if (!isBase(entry)) return session.refuse('reorder', screen, 'a state or an option has the place of its base: move the base')
  const flow = session.flowOrder(entry.flow)
  const path = flowPath(entry.flow)
  if (flow.error !== undefined) return session.refuse('reorder', screen, `${path} is not valid: ${flow.error}`)
  const order = movedOrder(flow.order ?? [], session.baseNames(entry.flow), entry.name, to)
  const text = flowText(flow.text, order)
  return session.plan('reorder', screen, { writes: text === flow.text ? [] : [{ path, text }] })
}

// Change the title of a screen: the `title` literal of its `meta`.
export function planTitle(reader: Reader, screen: string, title: string, widths: Widths = config.widths): Plan {
  const session = new Session(reader, widths)
  const entry = session.known('title', screen)
  if (isPlan(entry)) return entry
  if (title.trim() === '') return session.refuse('title', screen, 'the title is empty')
  const code = session.codes.get(entry.file)!
  const range = metaRanges(code, entry.file).title
  if (range === undefined) return session.refuse('title', screen, `the title in ${entry.file} is not a text literal`)
  if (range.value === title) return session.plan('title', screen, {})
  const output = new MagicString(code)
  output.overwrite(range.start, range.end, quoted(title, code[range.start]))
  return session.plan('title', screen, { writes: [{ path: entry.file, text: output.toString() }] })
}

// A target in a moved file gets its new path.
function movedTarget<T extends object>(item: T, files: ReadonlyMap<string, string>): T {
  const target = 'target' in item ? (item.target as Target | null) : null
  if (!target || !files.has(target.file)) return item
  return { ...item, target: { ...target, file: files.get(target.file)! } }
}

function movedRequest(request: RequestFile, ids: ReadonlyMap<string, string>, files: ReadonlyMap<string, string>): RequestFile {
  return {
    ...request,
    screen: ids.get(request.screen) ?? request.screen,
    file: files.get(request.file) ?? request.file,
    edits: request.edits.map((edit) => {
      const moved = movedTarget(edit, files)
      const change = moved.change
      return change.kind === 'keep' && ids.has(change.option) ? { ...moved, change: { ...change, option: ids.get(change.option)! } } : moved
    }),
  }
}

function movedIssues(issues: IssuesFile, ids: ReadonlyMap<string, string>, files: ReadonlyMap<string, string>): IssuesFile {
  return {
    ...issues,
    screen: ids.get(issues.screen) ?? issues.screen,
    file: files.get(issues.file) ?? issues.file,
    issues: issues.issues.map((issue) => movedTarget(issue, files)),
  }
}

// Parses a JSON file with a parser of the format, or gives the error.
function parsed<T>(text: string, parse: (json: unknown) => T): T | Error {
  try {
    return parse(JSON.parse(text))
  } catch (error) {
    return new Error(messageOf(error))
  }
}

// The parts of a rename plan that its steps add to: the moved ids (old to
// new), the moved screen files (old path to new path), and the moves, the
// writes and the refusals of the plan.
type RenameParts = {
  session: Session
  moved: Map<string, string>
  files: Map<string, string>
  moves: Plan['moves']
  writes: Plan['writes']
  refusals: string[]
}

// A file at the new path is a refusal. A move that changes only the case of
// the name reads no file there: on a file system that ignores the case, the
// read would give the file itself.
function takenPath(session: Session, source: string, target: string): boolean {
  return !caseOnly(source, target) && session.read(target) !== null
}

// A request or issues file at the new id: no screen has that id (the check of
// the ids of `planRename`), thus it is left from a screen that is gone.
function leftover(path: string): string {
  return `the file ${path} exists, left from a screen that is no longer there: move it out of ${config.work} first`
}

// The request files: a moved one moves; a `keep` of a moved option changes. A
// file that the rename does not change is not in the reads of the plan, thus a
// write of an agent there does not stop the rename.
function renameRequests({ session, moved, files, moves, writes, refusals }: RenameParts): void {
  const folder = workFolder('requests')
  for (const path of session.reader.list(folder).filter((path) => path.endsWith('.json'))) {
    const id = path.slice(`${folder}/`.length, -'.json'.length)
    const next = moved.get(id)
    const text = next === undefined ? session.reader.read(path) : session.read(path)
    if (text === null) continue
    const request = parsed(text, parseRequest)
    if (request instanceof Error) {
      if (next !== undefined) refusals.push(`the request file ${path} is not valid: ${request.message}`)
      continue
    }
    const newRequest = movedRequest(request, moved, files)
    const changed = fileText(newRequest) !== fileText(request)
    if (next === undefined && !changed) continue
    session.record(path, text)
    const newPath = next === undefined ? path : workFile('requests', next)
    if (next !== undefined) {
      if (takenPath(session, path, newPath)) refusals.push(leftover(newPath))
      moves.push({ from: path, to: newPath })
    }
    writes.push({ path: newPath, text: fileText(newRequest) })
  }
}

// The issues files of the moved screens. One that is not valid moves as it is.
function renameIssues({ session, moved, files, moves, writes, refusals }: RenameParts): void {
  for (const [from, next] of moved) {
    const path = workFile('issues', from)
    const text = session.read(path)
    if (text === null) continue
    const newPath = workFile('issues', next)
    if (takenPath(session, path, newPath)) refusals.push(leftover(newPath))
    moves.push({ from: path, to: newPath })
    const issues = parsed(text, parseIssues)
    if (!(issues instanceof Error)) writes.push({ path: newPath, text: fileText(movedIssues(issues, moved, files)) })
  }
}

// The writes of the `flow.json` of the two flows of a moved base screen. A
// file that is not valid stays.
function renamedFlowFiles(session: Session, entry: ScreenEntry, to: { flow: string; name: string }): Plan['writes'] {
  const writes: Plan['writes'] = []
  const old = session.flowOrder(entry.flow)
  if (to.flow === entry.flow) {
    if (old.order?.includes(entry.name)) {
      // A name that the list already has (an older entry) is there one time.
      const order = old.order.map((name) => (name === entry.name ? to.name : name)).filter((name, index, all) => all.indexOf(name) === index)
      writes.push({ path: flowPath(entry.flow), text: flowText(old.text, order) })
    }
    return writes
  }
  if (old.order?.includes(entry.name)) {
    writes.push({ path: flowPath(entry.flow), text: flowText(old.text, old.order.filter((name) => name !== entry.name)) })
  }
  const target = session.flowOrder(to.flow)
  if (target.order !== null && !target.order.includes(to.name)) {
    writes.push({ path: flowPath(to.flow), text: flowText(target.text, [...target.order, to.name]) })
  }
  return writes
}

// Rename a screen, or move it to a different flow (`to.flow`; '' is the
// screens folder itself). Its states and options go with it; a state or an
// option whose name starts with the name of the screen and `-` gets the new
// name in its place (`welcome-option-2` of `welcome` is `hello-option-2` of
// `hello`). A state and an option stay in the flow of their base. Each
// literal id of the moved screens in each screen file changes, the request
// and issues files move with their screen, and the `flow.json` of the two
// flows change.
export function planRename(
  reader: Reader,
  screen: string,
  to: { flow: string; name: string },
  widths: Widths = config.widths,
): Plan {
  const session = new Session(reader, widths)
  const refuse = (...reasons: string[]) => session.refuse('rename', screen, ...reasons)
  const entry = session.known('rename', screen)
  if (isPlan(entry)) return entry
  const problem = nameProblem(to.name) ?? flowProblem(to.flow)
  if (problem !== null) return refuse(problem)
  if (!isBase(entry) && to.flow !== entry.flow) {
    return refuse('a state or an option stays in the flow of its base: move the base')
  }
  const newId = idOf(to.flow, to.name)
  if (newId === screen) return refuse('the new id is the id of the screen')

  // The ids: the screen, then its states and options.
  const ids = new Map<string, string>([[screen, newId]])
  for (const member of session.group(screen)) {
    const name = memberName(member.name, entry.name, to.name)
    ids.set(member.id, idOf(to.flow, name))
  }
  const moved = [...ids].filter(([from, next]) => from !== next)
  // A file system can ignore the case of a name (macOS, Windows): a flow or an
  // id that differs from one that exists only in its case would be the same
  // file there, with a different id in the links and the request files.
  const existing = new Map(session.entries.map((item) => [item.id.toLowerCase(), item.id]))
  const refusals: string[] = []
  const flows = new Set(session.entries.map((item) => item.flow))
  const sameFlow = [...flows].find((flow) => flow !== to.flow && flow.toLowerCase() === to.flow.toLowerCase())
  if (sameFlow !== undefined) refusals.push(`the flow '${sameFlow}' exists; a flow name that differs only in its case is the same folder on some file systems`)
  const targets = new Set<string>()
  for (const [from, next] of moved) {
    const other = existing.get(next.toLowerCase())
    if (other !== undefined && other !== from) refusals.push(`a screen with the id '${other}' exists`)
    else if (targets.has(next.toLowerCase())) refusals.push(`two screens would get the id '${next}'`)
    targets.add(next.toLowerCase())
  }
  if (refusals.length > 0) return refuse(...refusals)

  const files = new Map(moved.map(([from, next]) => [screenPath(from), screenPath(next)]))
  const parts: RenameParts = { session, moved: new Map(moved), files, moves: [], writes: [], refusals }
  for (const [from, next] of files) {
    if (takenPath(session, from, next)) refusals.push(`the file ${next} exists`)
    parts.moves.push({ from, to: next })
  }

  // Each screen file: the links and the relations to a moved screen.
  for (const item of session.entries) {
    const code = session.codes.get(item.file)!
    const text = rewriteIds(code, idLiterals(code, item.file), ids)
    if (text !== code) parts.writes.push({ path: files.get(item.file) ?? item.file, text })
  }
  renameRequests(parts)
  renameIssues(parts)
  if (isBase(entry)) parts.writes.push(...renamedFlowFiles(session, entry, to))

  if (refusals.length > 0) return refuse(...refusals)
  return session.plan('rename', screen, {
    screens: moved.map(([from, next]) => ({ from, to: next })),
    moves: parts.moves,
    writes: parts.writes,
  })
}

// The time of a trash folder: `20261123-101500`, in UTC.
function stamp(time: Date): string {
  return time.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
}

function trashFolder(): string {
  return `${folderPrefix(config.work)}${trashName}`
}

// Delete a screen: move its file, its states, its options and their request
// and issues files into `.canvas/trash/<time>-<id with dashes>/`, with a
// manifest, and take its name out of the `flow.json` of its flow.
// `linkedBy` names the screens that link to it.
export function planDelete(reader: Reader, screen: string, time: Date, widths: Widths = config.widths): Plan {
  const session = new Session(reader, widths)
  const entry = session.entry(screen)
  if (entry === undefined) return session.refuse('delete', screen, `no screen has the id '${screen}'`)
  const deleted = [entry, ...session.group(screen)]
  const deletedIds = new Set(deleted.map((item) => item.id))
  const linkedBy = session.entries
    .filter((item) => !deletedIds.has(item.id) && item.links.some((id) => deletedIds.has(id)))
    .map((item) => item.id)

  const base = `${trashFolder()}/${stamp(time)}-${screen.replaceAll('/', '-')}`
  let folder = base
  for (let count = 2; reader.list(folder).length > 0; count++) folder = `${base}-${count}`

  const files = deleted.flatMap((item) =>
    [item.file, workFile('requests', item.id), workFile('issues', item.id)].filter(
      (path) => session.read(path) !== null,
    ),
  )
  const moves = files.map((path) => ({ from: path, to: `${folder}/${path}` }))
  for (const move of moves) session.read(move.to)
  const writes: Plan['writes'] = []
  let flowOrder: string[] | null = null
  if (isBase(entry)) {
    const flow = session.flowOrder(entry.flow)
    if (flow.order?.includes(entry.name)) {
      flowOrder = flow.order
      writes.push({ path: flowPath(entry.flow), text: flowText(flow.text, flow.order.filter((name) => name !== entry.name)) })
    }
  }
  const manifest: TrashManifest = { screen, files, flowOrder, time: time.toISOString() }
  const manifestPath = `${folder}/${manifestName}`
  session.read(manifestPath)
  writes.push({ path: manifestPath, text: `${JSON.stringify(manifest, null, 2)}\n` })
  return session.plan('delete', screen, {
    screens: deleted.map((item) => ({ from: item.id, to: null })),
    linkedBy,
    moves,
    writes,
  })
}

// A relative path with no `..` part and no root.
function isInnerPath(path: string): boolean {
  return path !== '' && !path.startsWith('/') && !/^[A-Za-z]:/.test(path) && !path.split(/[\\/]/).includes('..')
}

// Checks the text of a manifest, or throws.
export function parseManifest(text: string): TrashManifest {
  const data = JSON.parse(text) as Record<string, unknown>
  if (typeof data !== 'object' || data === null) throw new Error('the manifest is not an object')
  const { screen, files, flowOrder, time } = data
  if (typeof screen !== 'string' || screen === '') throw new Error('the manifest has no `screen`')
  if (!Array.isArray(files) || !files.every((file) => typeof file === 'string' && isInnerPath(file))) {
    throw new Error('`files` of the manifest must be a list of paths in the project')
  }
  if (flowOrder !== null && !(Array.isArray(flowOrder) && flowOrder.every((name) => typeof name === 'string'))) {
    throw new Error('`flowOrder` of the manifest must be a list of names or null')
  }
  if (typeof time !== 'string') throw new Error('the manifest has no `time`')
  return { screen, files, flowOrder, time }
}

// The `order` with `name` back at its place of `before`: before the first
// name that came after it there and is in `order`, else at the end.
function restoredOrder(order: readonly string[], before: readonly string[], name: string): string[] {
  if (order.includes(name)) return [...order]
  const after = before.slice(before.indexOf(name) + 1)
  const next = order.findIndex((item) => after.includes(item))
  return next === -1 ? [...order, name] : [...order.slice(0, next), name, ...order.slice(next)]
}

// Restore a deleted screen from its trash folder (`name` is the folder name
// in `.canvas/trash/`): each file goes back to its path, and the name goes
// back into the `flow.json` of its flow when that file exists. A file that
// exists again at its path is a refusal.
export function planRestore(reader: Reader, name: string, widths: Widths = config.widths): Plan {
  const session = new Session(reader, widths)
  if (name.includes('/') || name.includes('\\') || !isInnerPath(name)) {
    return session.refuse('restore', name, `'${name}' is not a folder of the trash`)
  }
  const folder = `${trashFolder()}/${name}`
  const manifestPath = `${folder}/${manifestName}`
  const text = session.read(manifestPath)
  if (text === null) return session.refuse('restore', name, `the trash has no folder '${name}'`)
  let manifest: TrashManifest
  try {
    manifest = parseManifest(text)
  } catch (error) {
    return session.refuse('restore', name, `${manifestPath} is not valid: ${messageOf(error)}`)
  }
  // A manifest is a file that an agent or a person can change: it names only a
  // valid id, and only screen files, request files and issues files.
  const idProblem = nameProblem(nameOfId(manifest.screen)) ?? flowProblem(flowOfId(manifest.screen))
  if (idProblem !== null) return session.refuse('restore', name, `${manifestPath} is not valid: ${idProblem}`)
  const work = folderPrefix(config.work)
  const allowed = (path: string) =>
    (path.startsWith(folderPrefix(config.screens)) && path.endsWith(screenExtension)) ||
    ((path.startsWith(`${work}requests/`) || path.startsWith(`${work}issues/`)) && path.endsWith('.json'))
  const other = manifest.files.find((path) => !allowed(path))
  if (other !== undefined) return session.refuse('restore', name, `${manifestPath} is not valid: ${other} is not a screen, request or issues file`)
  const refusals: string[] = []
  const moves = manifest.files.map((path) => ({ from: `${folder}/${path}`, to: path }))
  for (const move of moves) {
    if (session.read(move.from) === null) refusals.push(`the trash has no file ${move.from}`)
    if (session.read(move.to) !== null) refusals.push(`the file ${move.to} exists`)
  }
  if (refusals.length > 0) return session.refuse('restore', manifest.screen, ...refusals)

  const writes: Plan['writes'] = []
  const flow = session.flowOrder(flowOfId(manifest.screen))
  if (manifest.flowOrder !== null && flow.order !== null) {
    const order = restoredOrder(flow.order, manifest.flowOrder, nameOfId(manifest.screen))
    if (order.length !== flow.order.length) {
      writes.push({ path: flowPath(flowOfId(manifest.screen)), text: flowText(flow.text, order) })
    }
  }
  const prefix = folderPrefix(config.screens)
  const restored = manifest.files
    .filter((path) => path.startsWith(prefix) && path.endsWith(screenExtension))
    .map((path) => path.slice(prefix.length, -screenExtension.length))
  return session.plan('restore', manifest.screen, {
    screens: [manifest.screen, ...restored.filter((id) => id !== manifest.screen)].map((id) => ({ from: null, to: id })),
    moves,
    writes,
    removes: [manifestPath],
  })
}

// The deleted screens in the trash, the newest first. A folder with no
// manifest, or with one that is not valid, is left out.
export function trashItems(reader: Reader): TrashItem[] {
  const prefix = `${trashFolder()}/`
  const items: TrashItem[] = []
  for (const path of reader.list(trashFolder())) {
    const folder = path.slice(prefix.length, -`/${manifestName}`.length)
    if (path !== `${prefix}${folder}/${manifestName}` || folder.includes('/')) continue
    const text = reader.read(path)
    if (text === null) continue
    try {
      const { screen, files, time } = parseManifest(text)
      items.push({ folder, screen, files, time })
    } catch {
      // Not a folder of a delete.
    }
  }
  return items.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : a.folder < b.folder ? 1 : -1))
}

export type ApplyResult = { applied: true } | { applied: false; refusals: string[] }

let tempCount = 0

// A path in the folder of the temporary files of the work folder.
function tempPath(root: string): string {
  tempCount += 1
  const folder = join(root, config.work, tempName)
  mkdirSync(folder, { recursive: true })
  return join(folder, `${process.pid}-${Date.now()}-${tempCount}`)
}

// Writes a whole file in one step: a temporary file, then a rename. An agent
// or the editor that reads the file at that moment sees the old or the new
// text, never a part.
function writeWhole(root: string, path: string, text: string): void {
  const temp = tempPath(root)
  writeFileSync(temp, text)
  try {
    mkdirSync(dirname(path), { recursive: true })
    renameSync(temp, path)
  } catch (error) {
    rmSync(temp, { force: true })
    throw error
  }
}

// Moves a file. A move that changes only the case of the name goes through a
// temporary name, because a file system that ignores the case can refuse it or
// do nothing.
function move(root: string, from: string, to: string): void {
  mkdirSync(dirname(to), { recursive: true })
  if (!caseOnly(from, to)) {
    renameSync(from, to)
    return
  }
  const temp = tempPath(root)
  renameSync(from, temp)
  renameSync(temp, to)
}

// Does a plan in the folder `root`. A plan with a refusal, and a plan whose
// files changed after it read them, change nothing and give the refusals. A
// step that fails puts back each step before it, and then throws. At the end,
// each folder that a move or a remove left empty goes, up to the folders of
// the screens folder and of the work folder.
export function applyPlan(root: string, plan: Plan): ApplyResult {
  if (plan.refusals.length > 0) return { applied: false, refusals: plan.refusals }
  const changed = plan.reads.filter((read) => readText(join(root, read.path)) !== read.text).map((read) => read.path)
  if (changed.length > 0) {
    return { applied: false, refusals: changed.map((path) => `${path} changed after the tool read it; try again`) }
  }

  const undo: (() => void)[] = []
  try {
    for (const step of plan.moves) {
      const from = join(root, step.from)
      const to = join(root, step.to)
      if (!caseOnly(step.from, step.to) && readText(to) !== null) throw new Error(`the file ${step.to} exists`)
      move(root, from, to)
      undo.push(() => move(root, to, from))
    }
    for (const write of plan.writes) {
      const path = join(root, write.path)
      const old = readText(path)
      writeWhole(root, path, write.text)
      undo.push(() => (old === null ? unlinkSync(path) : writeWhole(root, path, old)))
    }
    for (const remove of plan.removes) {
      const path = join(root, remove)
      const old = readFileSync(path, 'utf8')
      unlinkSync(path)
      undo.push(() => writeWhole(root, path, old))
    }
  } catch (error) {
    for (const step of undo.reverse()) {
      try {
        step()
      } catch {
        // Put back the other steps.
      }
    }
    throw error
  }

  const kept = new Set(
    ['.', config.screens, config.work, ...['requests', 'issues', trashName].map((name) => `${folderPrefix(config.work)}${name}`)].map(
      (folder) => folder.replace(/\/+$/, ''),
    ),
  )
  for (const path of [...plan.moves.map((move) => move.from), ...plan.removes]) {
    for (let folder = dirname(path); !kept.has(folder) && folder !== '' && folder !== '/'; folder = dirname(folder)) {
      try {
        if (readdirSync(join(root, folder)).length > 0) break
        rmdirSync(join(root, folder))
      } catch {
        break
      }
    }
  }
  return { applied: true }
}
