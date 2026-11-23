// `canvas init`, `canvas sync` and `canvas agents`: the files of a project.
//
// `canvas init` makes a project that works at once, with the library at the
// level `connected` (`levelOf` in `pack.ts`): the screens render with the
// library, and its tokens are set up later (level 2 of the skill
// canvas-library-setup). Two modes:
//
// - In a host (an ongoing project that has the tool as a dependency, or a
//   clone of the tool next to it): the project is `canvas/` of the host. The
//   command writes its config, its `tsconfig.json`, its `.gitignore`, the pack
//   of the library that the host has installed, an empty token file, and a
//   copy of the guide (`AGENTS.md` and `guide/`) with a line that names the
//   version of the tool. At the host root it writes the stubs of the skills
//   and one marked block in each instruction file (`adapters.ts`).
// - Standalone (the project is the tool repository): only the pack, with its
//   `package.json` (an npm workspace that installs the library), and the
//   command says which install to run.
//
// A file of the project is written only when it is not there (the user owns it
// then); the copy of the guide, the stubs and the block are the tool's own and
// are written again when they differ. Thus a second run changes nothing.
//
// The plans are pure over a disk given as an argument (`Disk`); `applyInit`
// writes a plan, and the `…Command` functions are the commands of `cli.ts`.

import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { posix } from 'node:path'
import { config } from '../canvas.config.ts'
import { agentSentence } from '../src/editor/requests/agent-sentence.ts'
import { tokensSentence } from '../src/frame/library-setup.ts'
import { formatTokens, isRecord } from '../src/tokens/format.ts'
import { adapterFiles, hostBlock, instructionFiles, skillFolders, withBlock, type SkillSource } from './adapters.ts'
import { choosePack, isAbsoluteSource, isFolderSource, manifestName, packsFolder, providerFile, tokensEntry, type FoundManifest } from './pack.ts'
import {
  guideName,
  guidePathOf,
  hostProjectFolder,
  hostRoot,
  isInside,
  isInstalled,
  namedProject,
  projectConfigName,
  readText,
  slashes,
} from './project.ts'
import { tokensEntryFile } from './react-resolve.ts'

// The disk as the plans read it. Each path is absolute, with `/` between the
// parts. `read` gives the text of a file, or null (no file, or a folder);
// `entries` gives the names in a folder, or null when it is no folder.
export type Disk = {
  read(path: string): string | null
  entries(path: string): string[] | null
}

export function diskOf(): Disk {
  return {
    read: readText,
    entries(path) {
      try {
        return statSync(path).isDirectory() ? readdirSync(path) : null
      } catch {
        return null
      }
    },
  }
}

// The files below a folder, also in its sub folders, as paths relative to it,
// sorted.
export function filesBelow(disk: Disk, folder: string): string[] {
  const names = disk.entries(folder)
  if (names === null) return []
  return names
    .flatMap((name) => {
      const path = posix.join(folder, name)
      return disk.entries(path) === null ? [name] : filesBelow(disk, path).map((file) => `${name}/${file}`)
    })
    .sort()
}

function parseJson(text: string | null): unknown {
  if (text === null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// The folder of the guide in the tool and in a project.
export const guideFolder = 'guide'

// The folder of the templates of a project, in the tool.
export const templatesFolder = 'tools/templates'

// The short name of the pack from its source: the scope of a scoped package
// (`@mui/material` gives `mui`), the name of a package, or the last part of a
// folder; lowercase letters, numbers and hyphens (the rule of `pack.ts`).
export function packNameOf(source: string): string {
  const base = isFolderSource(source)
    ? (source.replace(/\/+$/, '').split('/').pop() ?? '')
    : source.startsWith('@')
      ? source.slice(1).split('/')[0]
      : source
  const name = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return name === '' ? 'library' : name
}

// The library of the option `--library`: a package with an optional range
// (`@mui/material@^9`), or a folder of the host (`./src/ui`).
export type LibraryOption = { source: string; range: string | null }

export function parseLibrary(text: string): LibraryOption {
  if (isFolderSource(text)) return { source: text, range: null }
  const at = text.lastIndexOf('@')
  if (at <= 0) return { source: text, range: null }
  const range = text.slice(at + 1)
  return { source: text.slice(0, at), range: range === '' ? null : range }
}

// The names of the dependencies of a `package.json`, in the fields that a
// host uses for its own packages.
function dependencyNames(packageJson: unknown, fields: readonly string[]): string[] {
  if (!isRecord(packageJson)) return []
  return fields.flatMap((field) => {
    const value = packageJson[field]
    return isRecord(value) ? Object.keys(value) : []
  })
}

// The packages that React itself is made of: not a library of components.
const reactPackages = ['react', 'react-dom']

// The candidates for the library of a host: each package of `dependencies`
// that has React as a peer dependency, sorted. A package that a different
// candidate has as a peer dependency is left out: it is a part that the
// library needs (a styling engine), not the library. `read` gives the parsed
// `package.json` of an installed package, or null. Development dependencies
// are left out: they are tools of the host (tests, stories), seldom the
// components of the product.
export function libraryCandidates(hostPackage: unknown, read: (name: string) => unknown): string[] {
  const peers = new Map<string, string[]>()
  for (const name of dependencyNames(hostPackage, ['dependencies'])) {
    if (reactPackages.includes(name)) continue
    const packageJson = read(name)
    if (!isRecord(packageJson) || !isRecord(packageJson.peerDependencies)) continue
    const names = Object.keys(packageJson.peerDependencies)
    if (names.includes('react')) peers.set(name, names)
  }
  const needed = new Set([...peers.values()].flat())
  return [...peers.keys()].filter((name) => !needed.has(name)).sort()
}

// The stylesheet of a package, as an import: the first path of `exports`
// that ends with `.css`, or the field `style` when `exports` permits it.
// Null for none.
export function stylesheetOf(name: string, packageJson: unknown): string | null {
  if (!isRecord(packageJson)) return null
  const { exports, style } = packageJson
  if (isRecord(exports)) {
    const key = Object.keys(exports).find((path) => path.startsWith('./') && path.endsWith('.css') && !path.includes('*'))
    if (key !== undefined) return `${name}/${key.slice(2)}`
    if (!('./*' in exports)) return null
  }
  if (typeof style === 'string' && style.endsWith('.css')) return `${name}/${style.replace(/^\.\//, '')}`
  return null
}

// The version of the tool, from its `package.json`.
export function toolVersionOf(packageText: string | null): string {
  const data = parseJson(packageText)
  return isRecord(data) && typeof data.version === 'string' ? data.version : 'unknown'
}

// How `canvas <command>` runs in a project, written into its copy of
// `AGENTS.md`: `npx canvas <command>` with the tool below `node_modules`, else
// the script of a clone, from the folder of the project. `npx canvas` runs
// from the host root when the project is `canvas/` of the host (the lookup of
// the project finds it there), else from the folder of the project.
export function runOf(tool: string, project: string, host: string): { command: string; where: string } {
  const inFolder = ', in the folder of this file'
  if (isInstalled(tool)) {
    return { command: 'npx canvas', where: posix.relative(host, project) === hostProjectFolder ? '' : inFolder }
  }
  return { command: `node ${posix.join(posix.relative(project, tool), 'bin/canvas.js')}`, where: inFolder }
}

// The lines of the `AGENTS.md` of the tool that the copy in a project changes.
// `projectGuide` throws when one is missing: a test reads the real file.
export const guideTitle = '# Canvas Editor'
export const toolFolderRow = '| `src/`, `tools/` | The tool itself. A screen or a request never changes them. |'
export const commandLinePrefix = 'The guide writes each command of the tool as `canvas <command>`. Here,'
export const developerLinePrefix = 'For a developer of the tool itself'

// The line of the copy that names the version of the tool. `guideVersion`
// reads it back (`canvas status`).
export function versionLine(version: string): string {
  return `This copy of the guide was written by canvas-editor ${version}. Do not change it: \`canvas sync\` writes it again after an update of the tool.`
}

export function guideVersion(text: string | null): string | null {
  if (text === null) return null
  return /^This copy of the guide was written by canvas-editor (\S+)\. /m.exec(text)?.[1] ?? null
}

// The text of the `AGENTS.md` of a project from the one of the tool: the
// version line under the title, the line that says how the command runs
// there, and no row and no line about the code of the tool (a project has
// none).
export function projectGuide(text: string, version: string, run: { command: string; where: string }, guidePath: string): string {
  const lines = text.replaceAll('\r\n', '\n').split('\n')
  const find = (test: (line: string) => boolean, what: string): number => {
    const index = lines.findIndex(test)
    if (index < 0) throw new Error(`The AGENTS.md of the tool has no ${what}.`)
    return index
  }
  const title = find((line) => line === guideTitle, 'title')
  const command = find((line) => line.startsWith(commandLinePrefix), 'line of the command')
  const row = find((line) => line === toolFolderRow, 'row of the tool folders')
  const developer = find((line) => line.startsWith(developerLinePrefix), 'line for a developer of the tool')
  lines[command] =
    `${commandLinePrefix} \`canvas <command>\` runs as \`${run.command} <command>\`${run.where}: ` +
    `\`canvas check -- onboarding/welcome\` is \`${run.command} check -- onboarding/welcome\`.`
  lines[title] = `${guideTitle}\n\n${versionLine(version)}`
  // The fixed sentence names the guide with its path from the host root, as
  // the editor gives it.
  const sentence = agentSentence(guideName)
  for (const [index, line] of lines.entries()) lines[index] = line.replaceAll(sentence, agentSentence(guidePath))
  const out = lines.filter((_, index) => index !== row && index !== developer)
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '')}\n`
}

// Fills the `{{name}}` parts of a template.
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    if (!(name in values)) throw new Error(`The template has no value for ${name}.`)
    return values[name]
  })
}

export type FileWrite = { path: string; text: string }

// What a command does: the files to write and the folders or files to
// remove (absolute paths), what it says, and why it cannot run. A plan with
// a refusal changes nothing.
export type InitPlan = {
  writes: FileWrite[]
  removes: string[]
  notes: string[]
  refusals: string[]
  next: string[]
}

function emptyPlan(): InitPlan {
  return { writes: [], removes: [], notes: [], refusals: [], next: [] }
}

export type InitInput = {
  disk: Disk
  // The folder of the tool, of the host and of the project, absolute.
  tool: string
  host: string
  project: string
  // The value of `--library`, or null.
  library: string | null
  // The folder of the package where the command ran: in a repository with
  // workspaces a package below the host (`apps/web`), whose `package.json`
  // lists the library. The host when it is not given.
  workspace?: string
}

function isStandalone(input: Pick<InitInput, 'tool' | 'project'>): boolean {
  return slashes(input.tool) === slashes(input.project)
}

// A file that the user owns once it is there: written only when it is not.
function create(plan: InitPlan, disk: Disk, path: string, text: string): void {
  if (disk.read(path) === null && disk.entries(path) === null) plan.writes.push({ path, text })
}

// A file of the tool: written when it differs.
function keep(plan: InitPlan, disk: Disk, path: string, text: string): void {
  if (disk.read(path) !== text) plan.writes.push({ path, text })
}

function template(disk: Disk, tool: string, name: string): string {
  const text = disk.read(posix.join(tool, templatesFolder, `${name}.template`))
  if (text === null) throw new Error(`The template ${templatesFolder}/${name}.template of the tool is missing.`)
  return text
}

// The skills of the guide of the tool.
function guideSkills(disk: Disk, tool: string): SkillSource[] {
  const folder = posix.join(tool, guideFolder, 'skills')
  return (disk.entries(folder) ?? [])
    .map((name) => ({ folder: name, text: disk.read(posix.join(folder, name, 'SKILL.md')) }))
    .filter((skill): skill is SkillSource => skill.text !== null)
}

// The text that marks a stub that the tool wrote (`stubOf` in `adapters.ts`).
const stubMark = 'This is a stub. The skill is'

// The stubs of the skills at the host root: in `.agents/skills/`, and in
// `.github/skills/` and `.claude/skills/` when their parent folder exists. A
// stub of a skill that the guide no longer has is removed; a folder that is
// not a stub of the tool stays.
function planStubs(plan: InitPlan, input: InitInput): void {
  const { disk, tool, host, project } = input
  const skills = guideSkills(disk, tool)
  const folders = skillFolders.filter((folder, index) => index === 0 || disk.entries(posix.join(host, posix.dirname(folder))) !== null)
  const guidePath = posix.join(posix.relative(host, project), guideFolder)
  for (const file of adapterFiles(skills, folders, guidePath)) keep(plan, disk, posix.join(host, file.path), file.text)
  const names = skills.map((skill) => skill.folder)
  for (const folder of folders) {
    for (const name of disk.entries(posix.join(host, folder)) ?? []) {
      if (!name.startsWith('canvas-') || names.includes(name)) continue
      const text = disk.read(posix.join(host, folder, name, 'SKILL.md'))
      if (text !== null && text.includes(stubMark)) plan.removes.push(posix.join(host, folder, name))
    }
  }
}

// The copy of the guide in the project: `AGENTS.md` with the version line and
// the command line, and each file of `guide/`. A file of the copy that the
// guide of the tool no longer has is removed.
function planGuide(plan: InitPlan, input: InitInput): void {
  const { disk, tool, project } = input
  const agents = disk.read(posix.join(tool, guideName))
  if (agents === null) throw new Error(`The ${guideName} of the tool is missing.`)
  const version = toolVersionOf(disk.read(posix.join(tool, 'package.json')))
  const guide = projectGuide(agents, version, runOf(tool, project, input.host), guidePathOf(project, input.host))
  keep(plan, disk, posix.join(project, guideName), guide)
  const files = filesBelow(disk, posix.join(tool, guideFolder))
  for (const file of files) {
    keep(plan, disk, posix.join(project, guideFolder, file), disk.read(posix.join(tool, guideFolder, file)) ?? '')
  }
  for (const file of filesBelow(disk, posix.join(project, guideFolder))) {
    if (!files.includes(file)) plan.removes.push(posix.join(project, guideFolder, file))
  }
}

// The block in each instruction file of the host root: `AGENTS.md` (made when
// it is not there), and the others when they exist.
function planBlocks(plan: InitPlan, input: InitInput): void {
  const { disk, host, project } = input
  const block = hostBlock(posix.relative(host, project))
  for (const [index, name] of instructionFiles.entries()) {
    const path = posix.join(host, name)
    const text = disk.read(path)
    if (text === null && index > 0) continue
    keep(plan, disk, path, withBlock(text, block))
  }
}

// The refusal of a host mode that has no project folder of its own.
function projectIsHostProblem(input: Pick<InitInput, 'host' | 'project'>): string | null {
  return slashes(input.host) === slashes(input.project)
    ? `The project folder ${input.project} is the root of the host: choose a sub folder, such as ${hostProjectFolder}/.`
    : null
}

// `canvas sync` and the part of `canvas init` that is the tool's own: the copy
// of the guide, the stubs and the block. Standalone: only the stubs, because
// the guide is the tool's own files.
export function syncPlan(input: InitInput): InitPlan {
  const plan = emptyPlan()
  if (isStandalone(input)) {
    planStubs(plan, { ...input, host: input.tool })
    return plan
  }
  const problem = projectIsHostProblem(input)
  if (problem !== null) return { ...plan, refusals: [problem] }
  if (input.disk.read(posix.join(input.project, projectConfigName)) === null) {
    return { ...plan, refusals: [`${input.project} has no ${projectConfigName}: it is no project. Run canvas init first.`] }
  }
  planGuide(plan, input)
  planStubs(plan, input)
  planBlocks(plan, input)
  return plan
}

// `canvas agents` in a host: the stubs only.
export function agentsPlan(input: InitInput): InitPlan {
  const plan = emptyPlan()
  planStubs(plan, isStandalone(input) ? { ...input, host: input.tool } : input)
  return plan
}

// The pack state of the project on the disk (`readPackState` of `pack.ts`
// reads the same files). `CANVAS_NO_PACK` does not count here: init must see
// a pack that is there, or it would write a second one.
function packStateOn(disk: Disk, project: string) {
  const folder = posix.join(project, packsFolder)
  const found: FoundManifest[] = []
  for (const name of disk.entries(folder) ?? []) {
    const text = disk.read(posix.join(folder, name, manifestName))
    if (text !== null) found.push({ folder: name, text })
  }
  return choosePack(found)
}

// The `package.json` of a package that Node finds from a folder (the host):
// in `node_modules` of that folder or of a folder above it, as when the
// packages of a repository with workspaces are in its root. Null for none.
export function installedPackage(disk: Disk, folder: string, name: string): unknown {
  for (let at = folder; ; at = posix.dirname(at)) {
    const data = parseJson(disk.read(posix.join(at, 'node_modules', name, 'package.json')))
    if (data !== null) return data
    if (posix.dirname(at) === at) return null
  }
}

const installHint = (source: string) => `npm install ${source}`

// The `package.json` files whose dependencies can name the library: of the
// host and, in a repository with workspaces, of the package where the command
// ran.
function packageFiles(input: InitInput): string[] {
  const folders = [input.host, input.workspace ?? input.host]
  return [...new Set(folders)].map((folder) => posix.join(folder, 'package.json'))
}

// The dependencies of those files as one `package.json`.
function hostPackages(input: InitInput): Record<string, Record<string, unknown>> {
  const merged: Record<string, Record<string, unknown>> = {}
  for (const path of packageFiles(input)) {
    const data = parseJson(input.disk.read(path))
    if (!isRecord(data)) continue
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const value = data[field]
      if (isRecord(value)) merged[field] = { ...merged[field], ...value }
    }
  }
  return merged
}

// The library of the pack: from the option, or the one candidate of the host.
// Null with the refusal in the plan.
function chooseLibrary(plan: InitPlan, input: InitInput, standalone: boolean): LibraryOption | null {
  const { disk, host } = input
  // A package counts when the project can import it: Node looks in
  // `node_modules` from the project upward (`installedPackage`).
  if (input.library !== null) {
    const library = parseLibrary(input.library)
    if (isFolderSource(library.source)) {
      const folder = isAbsoluteSource(library.source) ? library.source.replaceAll('\\', '/') : posix.join(host, library.source)
      if (disk.entries(folder) === null) {
        plan.refusals.push(`The folder ${library.source} does not exist in ${host}: a folder of the library is relative to the host root.`)
        return null
      }
      return library
    }
    if (standalone) return library
    const names = dependencyNames(hostPackages(input), ['dependencies', 'devDependencies', 'peerDependencies'])
    // A package that the host does not list can be installed all the same
    // (a package of a workspace, or one that a different package brings).
    if (!names.includes(library.source) && installedPackage(disk, input.project, library.source) === null) {
      plan.refusals.push(`The host has no dependency ${library.source}: install it in the host first (${installHint(library.source)}), then run canvas init again.`)
      return null
    }
    if (library.range !== null) plan.notes.push(`The range ${library.range} is left out: the host has ${library.source} installed.`)
    return { source: library.source, range: null }
  }
  if (standalone) {
    plan.refusals.push('Name the library: canvas init --library <package>@<range> (for example @mui/material@^9).')
    return null
  }
  const candidates = libraryCandidates(hostPackages(input), (name) => installedPackage(disk, input.project, name))
  if (candidates.length === 1) {
    plan.notes.push(`The library: ${candidates[0]}, the one dependency of the host with React as a peer dependency.`)
    return { source: candidates[0], range: null }
  }
  if (candidates.length === 0) {
    plan.refusals.push(
      `No package of \`dependencies\` in ${packageFiles(input).join(' or ')} is installed with React as a peer dependency where the project ${input.project} can import it (in a repository with workspaces, run canvas init in the package that lists the library; when the library is installed only in \`node_modules\` of that package, name a project there: --project <package>/canvas). Name the library: canvas init --library <package>, or a folder of the host: --library ./src/<folder>.`,
    )
  } else {
    plan.refusals.push(
      [
        'More than one dependency of the host can be the library. Name it, with one of these commands:',
        ...candidates.map((name) => `  canvas init --library ${name}`),
      ].join('\n'),
    )
  }
  return null
}

// The files of a pack of level 1 (`connected`).
function planPack(plan: InitPlan, input: InitInput, library: LibraryOption, standalone: boolean): void {
  const { disk, tool, project } = input
  const name = packNameOf(library.source)
  const folder = posix.join(project, packsFolder, name)
  const isPackage = !isFolderSource(library.source)
  const stylesheet = isPackage ? stylesheetOf(library.source, installedPackage(disk, project, library.source)) : null
  create(plan, disk, posix.join(folder, manifestName), `${JSON.stringify({ name, sources: [library.source] }, null, 2)}\n`)
  create(
    plan,
    disk,
    posix.join(folder, providerFile),
    fill(template(disk, tool, 'provider.tsx'), {
      imports: stylesheet === null ? '' : `import '${stylesheet}'\n`,
      stylesheetNote: stylesheet === null ? ' as it is' : ' with the stylesheet of the library',
    }),
  )
  create(plan, disk, posix.join(folder, tokensEntry), template(disk, tool, 'tokens.ts'))
  create(plan, disk, posix.join(project, config.tokens), formatTokens([]))
  plan.notes.push(`The pack ${packsFolder}/${name}: the library ${library.source}, with no token yet.`)
  plan.notes.push(
    stylesheet === null
      ? `The provider (${packsFolder}/${name}/${providerFile}) renders the screen with no stylesheet: ${isPackage ? `${library.source} exports none that the command found` : 'the library is a folder of the host'}.`
      : `The provider (${packsFolder}/${name}/${providerFile}) imports the stylesheet ${stylesheet}.`,
  )
  if (standalone && isPackage) {
    const range = library.range ?? 'latest'
    create(
      plan,
      disk,
      posix.join(folder, 'package.json'),
      `${JSON.stringify({ name: `canvas-pack-${name}`, private: true, version: '0.0.0', type: 'module', dependencies: { [library.source]: range } }, null, 2)}\n`,
    )
    plan.next.push(`npm install (it installs ${library.source}@${range}, the package of the pack ${packsFolder}/${name}; add the peer dependencies of the library to ${packsFolder}/${name}/package.json when it names some)`)
  }
}

// `canvas init`.
export function initPlan(input: InitInput): InitPlan {
  const { disk, tool, project } = input
  const standalone = isStandalone(input)
  const plan = emptyPlan()
  if (!standalone) {
    const problem = projectIsHostProblem(input)
    if (problem !== null) return { ...plan, refusals: [problem] }
    const entries = disk.entries(project)
    if (entries === null && disk.read(project) !== null) return { ...plan, refusals: [`${project} is a file, not a folder.`] }
    if (entries !== null && entries.length > 0 && disk.read(posix.join(project, projectConfigName)) === null) {
      return { ...plan, refusals: [`${project} is not empty and is no canvas project (it has no ${projectConfigName}): choose a new or an empty folder with --project.`] }
    }
  }
  const state = packStateOn(disk, project)
  let created = false
  if (state.kind === 'error') return { ...plan, refusals: [`The pack is not valid: ${state.message}.`] }
  if (state.kind === 'one') {
    plan.notes.push(`The pack ${state.pack.folder} is there; init does not change it.`)
    if (input.library !== null && !state.pack.sources.includes(parseLibrary(input.library).source)) {
      plan.notes.push(`--library ${input.library} is left out: the pack has ${state.pack.sources.join(', ')}. To change the library, follow the skill canvas-library-setup.`)
    }
  } else {
    const library = chooseLibrary(plan, input, standalone)
    if (library === null) return { ...plan, notes: [], writes: [] }
    planPack(plan, input, library, standalone)
    created = true
  }
  if (!standalone) {
    create(plan, disk, posix.join(project, projectConfigName), template(disk, tool, 'canvas.config.ts'))
    create(
      plan,
      disk,
      posix.join(project, 'tsconfig.json'),
      fill(template(disk, tool, 'tsconfig.json'), { tokens: posix.relative(project, posix.join(tool, tokensEntryFile)) }),
    )
    create(plan, disk, posix.join(project, '.gitignore'), template(disk, tool, 'gitignore'))
    const sync = syncPlan({ ...input, disk: withWrites(disk, plan.writes) })
    plan.writes.push(...sync.writes)
    plan.removes.push(...sync.removes)
    const run = runOf(tool, project, input.host)
    const folder = posix.relative(input.host, project)
    plan.next.push(`${run.where === '' ? '' : `cd ${folder} && `}${run.command} dev (it opens the editor; the canvas shows the library)`)
  } else {
    plan.next.push('npm run dev (it opens the editor; the canvas shows the library)')
  }
  plan.next.push(
    created ? `Ask the agent for a screen. For the tokens of the library (not needed for the first screen), give it: ${tokensSentence}` : 'canvas status shows the state of the project.',
  )
  return plan
}

// A disk that has the planned writes, for a plan that builds on another.
function withWrites(disk: Disk, writes: readonly FileWrite[]): Disk {
  const files = new Map(writes.map((write) => [write.path, write.text]))
  return {
    read: (path) => files.get(path) ?? disk.read(path),
    entries: disk.entries,
  }
}

// Writes a plan. A remove of a path that is not there does nothing.
export function applyInit(plan: InitPlan): void {
  if (plan.refusals.length > 0) throw new Error(plan.refusals.join('\n'))
  for (const write of plan.writes) {
    mkdirSync(posix.dirname(write.path), { recursive: true })
    writeFileSync(write.path, write.text)
  }
  for (const path of plan.removes) rmSync(path, { recursive: true, force: true })
}

// The text that a command prints for a plan: each file, relative to `base`,
// then the notes and the next steps. The files in one of `groups` (absolute
// folders: the copy of the guide, a folder of stubs) are one line with their
// count.
export function planReport(plan: InitPlan, base: string, done: string, groups: readonly string[] = []): string {
  if (plan.refusals.length > 0) return plan.refusals.join('\n')
  const counts = new Map<string, number>()
  const lines: string[] = []
  for (const write of plan.writes) {
    const group = groups.find((folder) => write.path.startsWith(`${folder}/`))
    if (group === undefined) lines.push(`wrote ${posix.relative(base, write.path)}`)
    else {
      if (!counts.has(group)) lines.push(group)
      counts.set(group, (counts.get(group) ?? 0) + 1)
    }
  }
  for (const [index, line] of lines.entries()) {
    const n = counts.get(line)
    if (n !== undefined) lines[index] = `wrote ${posix.relative(base, line)}/ (${n === 1 ? '1 file' : `${n} files`})`
  }
  lines.push(...plan.removes.map((path) => `removed ${posix.relative(base, path)}`))
  if (lines.length === 0) lines.push(done)
  lines.push(...plan.notes)
  if (plan.next.length > 0) lines.push('', 'Next:', ...plan.next.map((step) => `  ${step}`))
  return lines.join('\n')
}

// The project of `canvas init`: the option, then the variable, then the tool
// itself when the command runs in the tool repository (standalone), else
// `canvas/` of the host. The host is the one that each later command finds
// for that project (`hostRoot` of `<current folder>/canvas`): in a repository
// with workspaces, run in a package below it, that is the root of the
// repository, thus the project, the stubs, the block and the lookup of later
// commands from the root agree.
export function initProject(
  option: string | null,
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
  tool: string,
  exists: (path: string) => boolean,
): string {
  const named = namedProject(option, env, cwd)
  if (named !== null) return named
  const folder = slashes(cwd)
  if (hostRoot(folder, exists) === slashes(tool)) return slashes(tool)
  // With no host above it, `hostRoot` gives the project itself.
  const nested = posix.join(folder, hostProjectFolder)
  const host = hostRoot(nested, exists)
  return host === nested ? nested : posix.join(host, hostProjectFolder)
}

// The package where the command ran: the nearest folder from `cwd` up to the
// host that has a `package.json`; the host when `cwd` is not in it.
export function workspaceOf(cwd: string, host: string, exists: (path: string) => boolean): string {
  const start = slashes(cwd)
  if (!isInside(start, host)) return host
  for (let folder = start; folder !== host; folder = posix.dirname(folder)) {
    if (exists(posix.join(folder, 'package.json'))) return folder
  }
  return host
}

// The input of a command: the host that the project gives, and the package
// where the command ran.
export function inputOf(tool: string, project: string, library: string | null, cwd: string): InitInput {
  const host = hostRoot(project, existsSync)
  return { disk: diskOf(), tool, project, host, library, workspace: workspaceOf(cwd, host, existsSync) }
}

function run(plan: InitPlan, input: InitInput, done: string): number {
  const groups = [posix.join(input.project, guideFolder), ...skillFolders.map((folder) => posix.join(input.host, folder))]
  if (plan.refusals.length > 0) {
    console.error(planReport(plan, input.host, done))
    return 1
  }
  applyInit(plan)
  console.log(planReport(plan, input.host, done, groups))
  return 0
}

export function initCommand(tool: string, project: string, library: string | null, cwd: string): number {
  const input = inputOf(tool, project, library, cwd)
  return run(initPlan(input), input, 'The project is set up; nothing changed.')
}

export function syncCommand(tool: string, project: string): number {
  const input = inputOf(tool, project, null, project)
  return run(syncPlan(input), input, 'The guide, the stubs and the block are up to date.')
}

export function agentsCommand(tool: string, project: string): number {
  const input = inputOf(tool, project, null, project)
  return run(agentsPlan(input), input, 'The stubs are up to date.')
}

