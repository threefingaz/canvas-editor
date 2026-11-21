// Finds the library pack: the one folder with all that is specific to one
// component library (`packs/<name>/`). The tool is not told which library it
// has; it reads the manifests `packs/*/pack.json`.
//
// No pack: the tool is in the state "no library". One pack: that is the
// library. More than one, or a manifest that is not valid: an error that names
// the cause, and the tool stops.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, posix } from 'node:path'
import { isRecord, messageOf } from '../src/tokens/format.ts'

// The folder of the packs, relative to the project root.
export const packsFolder = 'packs'

// The manifest file in the folder of a pack.
export const manifestName = 'pack.json'

// The folder of the code of the library in the folder of a pack, and its two
// entries: the wrapper of a screen and the token entry (which exports
// `tokens(): Token[]`).
export const libraryFolder = 'library'
export const providerFile = `${libraryFolder}/provider.tsx`
export const tokensEntry = `${libraryFolder}/tokens.ts`

// The environment variable that makes the lookup give no pack, to check the
// "no library" branches of the tool with the pack still on the disk.
export const noPackVariable = 'CANVAS_NO_PACK'

export type Pack = {
  // The short name, the same as the folder name: 'demo'.
  name: string
  // The npm package from which a component must be imported to count as
  // "from the library". A path below it counts too.
  package: string
  // The folder of the pack, relative to the project root: 'packs/demo'.
  folder: string
}

export type PackState =
  | { kind: 'none' }
  | { kind: 'one'; pack: Pack }
  | { kind: 'error'; message: string }

// One manifest file that was found: the name of its folder in `packs/` and
// the text of the file.
export type FoundManifest = { folder: string; text: string }

// The rule for a pack name: lowercase letters, numbers and hyphens.
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// The pack of one manifest, or the text of its problem.
function readManifest(found: FoundManifest): Pack | string {
  const path = `${packsFolder}/${found.folder}/${manifestName}`
  let data: unknown
  try {
    data = JSON.parse(found.text)
  } catch (error) {
    return `${path} is not valid JSON: ${messageOf(error)}`
  }
  if (!isRecord(data)) return `${path} must be an object with "name" and "package"`
  const { name, package: packageName } = data
  if (typeof name !== 'string' || name === '') return `${path} has no "name"`
  if (!namePattern.test(name)) {
    return `${path}: the name "${name}" must have only lowercase letters, numbers and hyphens`
  }
  if (name !== found.folder) {
    return `${path}: the name "${name}" must be the same as the folder name "${found.folder}"`
  }
  if (typeof packageName !== 'string' || packageName === '') return `${path} has no "package"`
  return { name, package: packageName, folder: `${packsFolder}/${found.folder}` }
}

// Pure: the state from the manifests that were found.
export function choosePack(found: FoundManifest[]): PackState {
  if (found.length === 0) return { kind: 'none' }
  if (found.length > 1) {
    const names = found.map((item) => `${packsFolder}/${item.folder}`).sort()
    return {
      kind: 'error',
      message: `more than one library pack: ${names.join(', ')}. Keep one pack in ${packsFolder}/ and move the others out`,
    }
  }
  const pack = readManifest(found[0])
  return typeof pack === 'string' ? { kind: 'error', message: pack } : { kind: 'one', pack }
}

function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

// Reads `packs/*/pack.json` under `root`. `CANVAS_NO_PACK=1` gives `none`.
// A folder in `packs/` with no manifest is not a pack and is left out. A link
// to a folder counts as a folder.
export function readPackState(
  root: string,
  env: Record<string, string | undefined> = process.env,
): PackState {
  if (env[noPackVariable] === '1') return { kind: 'none' }
  const folder = join(root, packsFolder)
  if (!existsSync(folder)) return { kind: 'none' }
  const found: FoundManifest[] = []
  try {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name)
      if (!entry.isDirectory() && !(entry.isSymbolicLink() && isFolder(path))) continue
      const file = join(path, manifestName)
      if (!existsSync(file)) continue
      found.push({ folder: entry.name, text: readFileSync(file, 'utf8') })
    }
  } catch (error) {
    return { kind: 'error', message: `${packsFolder}/ cannot be read: ${messageOf(error)}` }
  }
  return choosePack(found)
}

// Pure: the pack of a state, or null for no pack. An error of the state
// throws: the dev server or the build stops with its message. The Vite config
// reads the state once and gives the pack to each plugin.
export function packOf(state: PackState): Pack | null {
  if (state.kind === 'error') throw new Error(`canvas library: ${state.message}`)
  return state.kind === 'one' ? state.pack : null
}

// Pure: the absolute path of the provider of a pack. `root` is the project
// root with `/` between the parts.
export function providerPath(pack: Pack, root: string): string {
  return posix.join(root, pack.folder, providerFile)
}

// Pure: the absolute path of the token entry of a pack. `root` is the project
// root with `/` between the parts.
export function tokensEntryPath(pack: Pack, root: string): string {
  return posix.join(root, pack.folder, tokensEntry)
}

// Pure: the library folder of a pack, relative to the project root.
export function packLibraryFolder(pack: Pack): string {
  return posix.join(pack.folder, libraryFolder)
}

// Pure: the text of the problem of a pack with no provider.
export function noProviderMessage(pack: Pack, root: string): string {
  return `the pack ${pack.folder} has no ${providerFile}: ${providerPath(pack, root)} does not exist`
}

// Pure: true for a path whose change can change the pack state: the packs
// folder, a folder in it, a manifest, the library folder of a pack or its
// provider (a pack is ready only with its provider). `path` and `root` are
// absolute, with `/` between the parts.
export function touchesPackState(path: string, root: string): boolean {
  const prefix = root.endsWith('/') ? root : `${root}/`
  if (!path.startsWith(prefix)) return false
  const parts = path.slice(prefix.length).split('/')
  if (parts[0] !== packsFolder) return false
  if (parts.length <= 2) return true
  const inPack = parts.slice(2).join('/')
  return inPack === manifestName || inPack === libraryFolder || inPack === providerFile
}

export type PackChange =
  | { kind: 'same' }
  | { kind: 'restart' }
  | { kind: 'wait'; message: string }
  | { kind: 'error'; message: string }

// Pure: what the dev server does when the pack state on the disk is `next`
// and the server runs with `current`. A different pack (or a pack that came or
// went) restarts the server, which reads the state again. A new pack with no
// provider yet does not restart it (`wait`): the new config would stop on the
// missing provider, and the agent writes `pack.json` before the provider; the
// server restarts when the provider is there. An error does not restart it:
// the server keeps the pack it has and shows the error until the files are
// fixed. `hasProvider` tells whether the provider of a pack exists.
export function packChange(
  current: Pack | null,
  next: PackState,
  root: string,
  hasProvider: (pack: Pack) => boolean,
): PackChange {
  if (next.kind === 'error') return { kind: 'error', message: next.message }
  const pack = next.kind === 'one' ? next.pack : null
  const same =
    pack === null || current === null
      ? pack === current
      : pack.name === current.name && pack.package === current.package && pack.folder === current.folder
  if (same) return { kind: 'same' }
  if (pack !== null && !hasProvider(pack)) {
    return { kind: 'wait', message: `${noProviderMessage(pack, root)} yet; the dev server restarts when it exists` }
  }
  return { kind: 'restart' }
}
