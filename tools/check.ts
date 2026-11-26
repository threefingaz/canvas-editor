// The check of the screens: `npm run check`. It reads each screen file with
// the parser, with no browser, and finds what the file itself does against
// the rules of a screen and against the design system:
//
// - `file`: the file cannot be read as a screen (a syntax error, a wrong
//   `meta`), or a `flow.json` is not valid;
// - `relation`: `stateOf` or `optionOf` breaks a rule of the list;
// - `part`: the marker `canvas-part` of an option breaks a rule (more than
//   one marker, no JSX element after it, a screen that is not an option);
// - `broken-link`: a link to a screen address that no screen has;
// - `not-library`: an element that is not from the library (a plain element,
//   or a component of the file or of a different module; not an own
//   component of the project, in its components folder);
// - `inline-style`: an element with a `style` attribute;
// - `raw-value`: a length or a color as a text literal in an attribute, and a
//   number that stands for pixels, where the pack names the keys of its
//   scales (`scaleKeys` of its manifest);
// - `behavior`: a handler (`onClick`) or a hook (`useState`): a screen is a
//   picture of one state;
// - `class-name`: a `className` attribute: a screen has no styles of its own;
// - `import`: an import of the tool, or of a module with JSX that is not an
//   own component of the project;
// - `placeholder`: a placeholder text ("Lorem ipsum").
//
// A note is not a finding: a screen that no link reaches, the block of each
// option, the own components that a screen uses, and what is in the file of
// each own component.
//
// The editor shows the same things in its Issues list, read from the page;
// the check shows what the code says, thus an agent can run it after its work
// and a person before a review. It does not find a value that only the page
// shows (a number of pixels, a value that the code computes).

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, posix } from 'node:path'
import { config } from '../canvas.config.ts'
import { counted } from '../src/words.ts'
import { unreached } from '../src/related/links.ts'
import { flowErrors, flowFileName, type FlowFile } from './flow.ts'
import { isLibrarySource, type LibrarySources } from './jsx.ts'
import { sourceFolder } from './pack.ts'
import { isInnerPath, relativePath } from './project.ts'
import { screenFacts } from './screen-facts.ts'
import { readFlowFiles, readScreenFiles } from './screens-plugin.ts'
import { screenList, type ScreenEntry, type ScreenFile } from './screens.ts'

export const findingKinds = [
  'file',
  'relation',
  'part',
  'broken-link',
  'not-library',
  'inline-style',
  'raw-value',
  'behavior',
  'class-name',
  'import',
  'placeholder',
] as const

export type FindingKind = (typeof findingKinds)[number]

// `line` and `column` are the place of the element; a finding of the file or
// of its relation has none. `screen` is the id of the screen, or the flow of a
// `flow.json`.
export type Finding = { kind: FindingKind; screen: string; file: string; line?: number; column?: number; text: string }

// `screen` is the id of the screen of the note; a note of a file that is not
// a screen (an own component) has none.
export type Note = { screen?: string; text: string }

export type CheckResult = {
  // The count of the screens that the check read.
  screens: number
  findings: Finding[]
  notes: Note[]
  // The ids of the screens that the arguments named; with no argument, not
  // there. The report lists them, thus a wrong id shows.
  named?: string[]
}

export type CheckOptions = {
  // The sources of the library (`librarySources` in `pack.ts`), or null when
  // no library is connected.
  library: LibrarySources | null
  // The keys whose number is a step of a scale (`scaleKeys` of the pack), or
  // null or nothing when the pack does not say.
  scaleKeys?: readonly string[] | null
  // True when a path with no extension, relative to the project root, is a
  // file with JSX on the disk (`rows` for `rows.tsx`).
  isComponent?: (path: string) => boolean
  // The screens to report, as ids or as paths of files; with none, each
  // screen. The links and the relations are always read against the whole
  // list.
  only?: readonly string[]
  // The `flow.json` files of the screens folder. A file that is not valid is a
  // finding; it is reported with each screen, or when a screen of its flow is
  // in `only`.
  flows?: readonly FlowFile[]
  // The widths of a frame of the project (`widths` of its config); the widths
  // of the tool when not given.
  widths?: readonly number[]
  // The text of a file of the project (a path relative to the project root),
  // or null: for the own components that the screens import.
  readFile?: (path: string) => string | null
}

// The folder of the own components of a project (`components` of the config).
export const componentsFolder: string = config.components

// The path of a relative import of `file`, relative to the project root. A
// path that leaves the project starts with `../` (a file of the host). A
// source that starts with `/` is relative to the root (the bundler reads it
// from its root folder), not to the folder of `file`.
export function importPath(file: string, source: string): string {
  const rooted = source.startsWith('/')
  const parts = rooted ? [] : file.replaceAll('\\', '/').split('/').slice(0, -1)
  let above = 0
  for (const part of source.replaceAll('\\', '/').split('/')) {
    if (part === '..') {
      if (parts.length > 0) parts.pop()
      else above += 1
    } else if (part !== '.' && part !== '') parts.push(part)
  }
  return `${'../'.repeat(above)}${parts.join('/')}`
}

const isRelative = (source: string) => source.startsWith('./') || source.startsWith('../')

// True for a path (relative to the project root) in the components folder.
function inComponents(path: string): boolean {
  return path === componentsFolder || path.startsWith(`${componentsFolder}/`)
}

// True for an import of an own component of the project: a relative import
// into its components folder. A screen can have it; the canvas marks the
// component as not from the library.
export function isOwnComponent(file: string, source: string): boolean {
  return isRelative(source) && inComponents(importPath(file, source))
}

// The endings of the file that an import of code with no extension can be,
// in the sequence of `ownComponentFiles`: the file of a component (`.tsx`,
// the one form that the editor reads), then the forms that the check only
// names (a file with no JSX, a `.jsx` file).
const codeEndings = ['.tsx', '/index.tsx', '.ts', '/index.ts', '.jsx', '/index.jsx']

// The endings of a module with JSX among them.
const jsxEndings = codeEndings.filter((end) => end.endsWith('sx'))

// True for a path that names its file with an extension: one of code, of a
// stylesheet, of data or of a picture, a font or a medium. A part after a dot
// that is not one of them is a part of the name (`user.card`, `step.view`),
// thus the path has no extension and a bundler tries the endings of code.
const hasExtension = (path: string) =>
  /\.(tsx|ts|jsx|js|mts|cts|mjs|cjs|css|scss|sass|less|styl|json|svg|png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|ogg|md|txt|html)$/i.test(path)

// True for a path that can be a file of code: no extension, or the extension
// of one. A stylesheet or a data file is not one.
const isCodePath = (path: string) => !hasExtension(path) || /\.(tsx|jsx|ts)$/.test(path)

// The files that an import of an own component can be: the path as it is
// when it has an extension; else the path with each ending of `codeEndings`.
export function ownComponentFiles(path: string): string[] {
  return hasExtension(path) ? [path] : codeEndings.map((end) => `${path}${end}`)
}

// True for an import that a screen must not have: a virtual module of the
// tool, a file of the tool (`src/`, `tools/`, `canvas.config.ts`), or a module
// with JSX that is not in the components folder of the project. `file` is the
// screen file, relative to the project root; `isComponent` says for a path
// with no extension whether it is a file with JSX on the disk.
export function forbiddenImport(file: string, source: string, isComponent: (path: string) => boolean = () => false): boolean {
  if (source.startsWith('virtual:')) return true
  if (isOwnComponent(file, source)) return false
  const path = importPath(file, source)
  if (/\.(tsx|jsx)$/.test(path)) return true
  if (/^(src|tools)\//.test(path) || /^canvas\.config(\.ts)?$/.test(path)) return true
  return !hasExtension(path) && isComponent(path)
}

// The notes of the own components: one for each file, from the paths that
// the screens import (relative to the project root), and from the own
// components that these files import. The check does not judge an own
// component, but it says what is in it: an agent with no browser does not
// see the canvas. Only a `.tsx` file is read: it is the form that the editor
// gives the places of its elements.
export function ownComponentNotes(
  paths: Iterable<string>,
  readFile: (path: string) => string | null,
  library: LibrarySources | null,
  scale: Set<string> | null,
): Note[] {
  const notes: Note[] = []
  const note = (text: string) => notes.push({ text })
  const queue = [...new Set(paths)].sort()
  const seen = new Set<string>()
  for (let at = 0; at < queue.length; at += 1) {
    const path = queue[at]
    // The file of the import, as a bundler finds it.
    const file = ownComponentFiles(path).find((candidate) => readFile(candidate) !== null)
    if (file === undefined) {
      note(`${path}: an own component whose file is not found`)
      continue
    }
    if (seen.has(file)) continue
    seen.add(file)
    if (file.endsWith('.jsx')) {
      note(`${file}: an own component in a \`.jsx\` file: the editor reads only \`.tsx\` files, thus its elements cannot be selected`)
      continue
    }
    if (!file.endsWith('.tsx')) {
      note(`${file}: a file with no JSX: import each own component from its own file, thus the check reads it`)
      continue
    }
    try {
      const facts = screenFacts(readFile(file)!, file, library, scale)
      const counts: [number, string, string][] = [
        [facts.elements.filter((element) => element.origin === 'host').length, 'plain element', 'plain elements'],
        [facts.styles.length, '`style` attribute', '`style` attributes'],
        [facts.raw.length, 'raw value', 'raw values'],
        [facts.classNames.length, '`className` attribute', '`className` attributes'],
        [facts.behavior.length, 'handler or hook', 'handlers or hooks'],
        [facts.links.length, 'link to a screen that the check does not read', 'links to a screen that the check does not read'],
      ]
      const parts = counts.filter(([count]) => count > 0).map(([count, one, more]) => `${count} ${count === 1 ? one : more}`)
      note(`${file}: an own component${parts.length > 0 ? `, with ${parts.join(', ')}` : ', with no deviation in its code'}`)
      // The own components that this one imports (a stylesheet or a data
      // file is not one).
      for (const item of facts.imports) {
        const next = importPath(file, item.source)
        if (isOwnComponent(file, item.source) && isCodePath(next) && !queue.includes(next)) queue.push(next)
      }
    } catch (error) {
      note(`${file}: an own component that is not read: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return notes
}

function compare(a: Finding, b: Finding): number {
  return (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0)
}

// The id of a screen from an argument of the command: an id, or the path of
// its file relative to the project (`screens/onboarding/welcome.tsx`,
// `./screens/…`, with `\`). With `place` (absolute folders with `/`), also a
// path relative to the current folder or an absolute one, as a host gives it
// (`canvas/screens/onboarding/welcome.tsx` from the host root). `real` gives
// a path in the case of the disk (`diskCase`), as the project and the current
// folder are.
export function screenArgument(
  argument: string,
  entries: readonly { id: string; file: string }[],
  place?: { cwd: string; project: string; real?: (path: string) => string },
): string | null {
  const text = argument.replaceAll('\\', '/').replace(/^\.\//, '')
  const found = entries.find((entry) => entry.id === text || entry.file === text)
  if (found !== undefined || place === undefined) return found?.id ?? null
  // An absolute path as it is, else relative to the current folder; a drive
  // of Windows stays at the start, also for `..` above its root.
  const absolute = (place.real ?? ((path: string) => path))(sourceFolder(text, place.cwd))
  const path = relativePath(place.project, absolute)
  return entries.find((entry) => entry.file === path)?.id ?? null
}

export function checkScreens(files: readonly ScreenFile[], options: CheckOptions): CheckResult {
  const entries = screenList(files, options.widths, undefined, options.library, options.flows)
  const ids = new Set(entries.map((entry) => entry.id))
  const codeOf = new Map(files.map((file) => [file.file.replaceAll('\\', '/'), file.code]))
  const only = options.only && options.only.length > 0 ? new Set(options.only) : null
  // An import of the library is never a finding, also from a folder of the
  // host with JSX in it.
  const library = options.library
  const isFromLibrary = (source: string, file: string) => library !== null && isLibrarySource(source, file, library)

  const scale = options.scaleKeys ? new Set(options.scaleKeys) : null
  const findings: Finding[] = []
  // What the check read and does not judge, for an agent with no browser:
  // the block that the marker of an option gives (or that it has no marker),
  // the own components that a screen uses, and what is in each of their
  // files.
  const readNotes: Note[] = []
  // The files of the own components that the checked screens import.
  const ownFiles = new Set<string>()
  for (const flow of flowErrors(options.flows ?? [])) {
    if (only && !entries.some((entry) => entry.flow === flow.flow && only.has(entry.id))) continue
    findings.push({ kind: 'file', screen: flow.flow, file: flow.file, text: `the sequence of the row: ${flow.error}` })
  }
  for (const entry of entries) {
    if (only && !only.has(entry.id)) continue
    const base = { screen: entry.id, file: entry.file }
    if (entry.error !== undefined) {
      findings.push({ ...base, kind: 'file', text: entry.error })
      continue
    }
    if (entry.relationError !== undefined) findings.push({ ...base, kind: 'relation', text: entry.relationError })
    if (entry.partError !== undefined) findings.push({ ...base, kind: 'part', text: entry.partError })

    const facts = screenFacts(codeOf.get(entry.file) ?? '', entry.file, options.library, scale)
    if (entry.optionOf !== undefined && entry.partError === undefined) {
      const block = facts.elements.find((element) => `${element.line}:${element.column}` === entry.part)
      const text =
        entry.part === undefined
          ? `${entry.file}: an option of ${entry.optionOf} with no marker \`canvas-part\`: the canvas shows the whole screen`
          : `${entry.file}: an option of ${entry.optionOf}; its block is ${block ? `<${block.tag}>` : 'the element'} at ${entry.part}`
      readNotes.push({ screen: entry.id, text })
    }
    const placed: Finding[] = []
    for (const link of facts.links) {
      if (!ids.has(link.id)) {
        placed.push({ ...base, kind: 'broken-link', line: link.line, column: link.column, text: `${link.tag}: link to ${link.href}, no screen with this id` })
      }
    }
    // An own component of the project is a deviation that the canvas shows,
    // not a finding: the user asked for it.
    const own = new Set<string>()
    for (const element of facts.elements) {
      if (element.source === undefined || !isOwnComponent(entry.file, element.source)) continue
      own.add(element.tag)
      ownFiles.add(importPath(entry.file, element.source))
    }
    if (own.size > 0) readNotes.push({ screen: entry.id, text: `${entry.file}: own components, not from the library: ${[...own].join(', ')}` })
    if (options.library !== null) {
      for (const element of facts.elements) {
        if (element.origin === 'library' || own.has(element.tag)) continue
        const what = element.origin === 'host' ? 'an HTML element' : 'a local component'
        placed.push({ ...base, kind: 'not-library', line: element.line, column: element.column, text: `${element.tag}: ${what}, not from the library` })
      }
    }
    for (const style of facts.styles) {
      placed.push({ ...base, kind: 'inline-style', line: style.line, column: style.column, text: `${style.tag}: a \`style\` attribute` })
    }
    for (const raw of facts.raw) {
      const text = raw.number ? `${raw.tag}: \`${raw.text}\` in \`${raw.attribute}\`, a number of pixels` : `${raw.tag}: '${raw.text}' in \`${raw.attribute}\``
      placed.push({ ...base, kind: 'raw-value', line: raw.line, column: raw.column, text })
    }
    for (const item of facts.behavior) placed.push({ ...base, kind: 'behavior', line: item.line, column: item.column, text: `${item.text}: a screen has no state and no handlers` })
    for (const item of facts.classNames) placed.push({ ...base, kind: 'class-name', line: item.line, column: item.column, text: `${item.tag}: a \`className\` attribute` })
    for (const item of facts.imports.filter((item) => !isFromLibrary(item.source, entry.file) && forbiddenImport(entry.file, item.source, options.isComponent))) placed.push({ ...base, kind: 'import', line: item.line, column: item.column, text: `the import of '${item.source}': a screen imports only the library, an own component in \`${componentsFolder}/\`, and plain data` })
    for (const item of facts.placeholders) placed.push({ ...base, kind: 'placeholder', line: item.line, column: item.column, text: 'a placeholder text' })
    findings.push(...placed.sort(compare))
  }

  if (options.readFile !== undefined) readNotes.push(...ownComponentNotes(ownFiles, options.readFile, options.library, scale))

  const titles = new Map(entries.map((entry) => [entry.id, entry]))
  const notes = unreached(entries)
    .filter((id) => !only || only.has(id))
    .map((id): Note => ({ screen: id, text: `${titles.get(id)!.file}: no link leads to this screen` }))
    .concat(readNotes)
  const named = only ? entries.filter((entry) => only.has(entry.id)).map((entry) => entry.id) : null

  return { screens: named ? named.length : entries.length, findings, notes, ...(named ? { named } : {}) }
}

// The text that the command prints: the findings by file, each with its
// place, then the total, then the notes.
export function checkReport(result: CheckResult): string {
  const lines: string[] = []
  const files = [...new Set(result.findings.map((finding) => finding.file))]
  // A finding of a `flow.json` is not in a screen: the total counts it apart.
  const isFlowFile = (file: string) => posix.basename(file) === flowFileName
  const screenFiles = files.filter((file) => !isFlowFile(file)).length
  const flowFiles = files.length - screenFiles
  for (const file of files) {
    lines.push(file)
    for (const finding of result.findings.filter((item) => item.file === file)) {
      const place = finding.line === undefined ? '' : `${finding.line}:${finding.column}`
      lines.push(`  ${place.padEnd(7)} ${finding.kind.padEnd(12)} ${finding.text}`)
    }
    lines.push('')
  }
  lines.push(
    result.findings.length === 0
      ? `No finding in ${counted(result.screens, 'screen')}.`
      : `${counted(result.findings.length, 'finding')} in ${[
          ...(screenFiles > 0 || flowFiles === 0 ? [`${screenFiles} of ${counted(result.screens, 'screen')}`] : []),
          ...(flowFiles > 0 ? [counted(flowFiles, `${flowFileName} file`)] : []),
        ].join(' and ')}.`,
  )
  if (result.named && result.named.length > 0) lines.push(`Checked: ${result.named.join(', ')}.`)
  if (result.notes.length > 0) {
    lines.push('', 'Notes (not findings):')
    for (const note of result.notes) lines.push(`  ${note.text}`)
  }
  return lines.join('\n')
}

// The screens of a project as the check reads them from the disk: the screen
// files, the `flow.json` files and the list. `canvas check` and
// `canvas status` read them here, thus their counts agree.
export type ProjectScreens = { files: ScreenFile[]; flows: FlowFile[]; entries: ScreenEntry[] }

export function readProjectScreens(project: string, screensFolder: string, widths: readonly number[]): ProjectScreens {
  const folder = join(project, screensFolder)
  const files = readScreenFiles(project, folder)
  const flows = readFlowFiles(project, folder)
  return { files, flows, entries: screenList(files, widths, screensFolder, null, flows) }
}

// The text of a file of a project, by its path relative to the project
// root; null for a path that leaves the project (the reader serves the
// paths of the own components, and reads nothing of the host), for no file,
// and for a folder.
export function projectReader(project: string): (path: string) => string | null {
  return (path) => {
    if (!isInnerPath(path)) return null
    const file = join(project, path)
    return existsSync(file) && statSync(file).isFile() ? readFileSync(file, 'utf8') : null
  }
}

// The check of the screens of a project (`readProjectScreens`). A path with no
// extension is a component when a file with JSX is there on the disk.
export function checkProject(
  project: string,
  screens: ProjectScreens,
  options: Pick<CheckOptions, 'library' | 'scaleKeys' | 'only'> & { widths: readonly number[] },
): CheckResult {
  const isComponent = (path: string) => jsxEndings.some((end) => existsSync(join(project, path + end)))
  const readFile = projectReader(project)
  return checkScreens(screens.files, { ...options, isComponent, readFile, flows: screens.flows })
}
