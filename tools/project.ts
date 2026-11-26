// The project root and the host root.
//
// The tool and its content can be two folders. The project is the folder of
// the content: `screens/`, `packs/`, `tokens.json`, `.canvas/`, and its own
// `canvas.config.ts` and `AGENTS.md`. The root of Vite stays the folder of the
// tool. In standalone (this repository, a clone of the clean tool) the project
// is the folder of the tool.
//
// The host is the folder where the agent works: the repository of an ongoing
// project that has the canvas project in a sub folder (`canvas/`). In
// standalone it is the project.
//
// `projectRoot` and `hostRoot` are pure: they take the environment, the
// current folder and a test for a path as arguments. `currentProject` calls
// the first with the values of this process.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The variable of the project folder. The command (`tools/cli.ts`) sets it to
// the folder that it found, thus the Vite config, each script and each child
// process (the token script of the dev server) read the same project.
export const projectVariable = 'CANVAS_PROJECT'

// The config file of a project, and the sub folder of a host that has the
// project in it.
export const projectConfigName = 'canvas.config.ts'
export const hostProjectFolder = 'canvas'

// The guide of a project: the file that the fixed sentence names.
export const guideName = 'AGENTS.md'

// The folder of the built site in the project.
export const distFolder = 'dist'

// The folder of the tool, with `/` between the parts and no `/` at the end.
// In the case of the disk (`diskCase`): a command typed in a different case
// names the same folder, and the relative paths from a project to the tool
// must not go up and down again.
export const toolRoot = diskCase(slashes(fileURLToPath(new URL('..', import.meta.url))))

export type Exists = (path: string) => boolean

// An absolute path with `/` between the parts and no `/` at the end (except
// the root of the file system).
export function slashes(path: string): string {
  const text = path.replaceAll('\\', '/')
  return text.length > 1 && text.endsWith('/') && !/^[A-Za-z]:\/$/.test(text) ? text.slice(0, -1) : text
}

function absolute(path: string, cwd: string): string {
  return slashes(resolve(cwd, path))
}

// True on a platform whose file systems by default have no case in a name
// (macOS, Windows): `/Work/App` and `/work/app` are one folder there.
export const foldsCase: boolean = process.platform === 'darwin' || process.platform === 'win32'

// True when two absolute paths are one folder: with `/` or `\` between the
// parts, and with no regard to the case of the letters where the file system
// has none (`fold`).
export function samePath(a: string, b: string, fold: boolean = foldsCase): boolean {
  const [x, y] = [slashes(a), slashes(b)]
  return fold ? x.toLowerCase() === y.toLowerCase() : x === y
}

// The folder as the disk spells it, when it differs only in the case of its
// letters (`--project ~/work/App` for `~/Work/app` on macOS): the file watcher
// gives each path in the case of the disk, and the plugins compare paths as
// they are. A link stays as it is. A folder that is not there yet (`canvas/`
// of `canvas init`) gets the case of its nearest parent that is there.
export function diskCase(folder: string): string {
  try {
    const real = slashes(realpathSync.native(folder))
    return real !== folder && samePath(real, folder, true) ? real : folder
  } catch {
    const parent = parentOf(folder)
    if (parent === null) return folder
    const cased = diskCase(parent)
    if (cased === parent) return folder
    const rest = folder.slice(parent.length).replace(/^\//, '')
    return cased.endsWith('/') ? `${cased}${rest}` : `${cased}/${rest}`
  }
}

// The parent of an absolute folder with `/` between the parts, or null at the
// root of the file system: `/`, or the root of a drive of Windows (`C:/`).
// `posix.dirname` reads `C:/x` as `C:` and `C:/` as `.`, a relative folder.
export function parentOf(folder: string): string | null {
  if (/^[A-Za-z]:\/?$/.test(folder)) return null
  const parent = posix.dirname(folder)
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}/`
  return parent === folder || parent === '.' ? null : parent
}

// The folder that the user named: the option `--project`, else the variable
// `CANVAS_PROJECT`, relative to `cwd`; null with neither.
export function namedProject(option: string | null, env: Readonly<Record<string, string | undefined>>, cwd: string): string | null {
  if (option !== null && option !== '') return absolute(option, cwd)
  const variable = env[projectVariable]
  return variable !== undefined && variable !== '' ? absolute(variable, cwd) : null
}

// The folder of the project, in this sequence: the option `--project`, the
// variable `CANVAS_PROJECT`, the nearest folder from `cwd` upward that has
// `canvas.config.ts` (that folder) or `canvas/canvas.config.ts` (its
// `canvas` folder), and else the folder of the tool. A relative folder is
// relative to `cwd`. The folder of the option and of the variable is not
// checked here (`folderProblem`).
export function projectRoot(
  option: string | null,
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
  tool: string,
  exists: Exists,
): string {
  const named = namedProject(option, env, cwd)
  if (named !== null) return named
  for (let folder: string | null = absolute(cwd, cwd); folder !== null; folder = parentOf(folder)) {
    if (exists(posix.join(folder, projectConfigName))) return folder
    const nested = posix.join(folder, hostProjectFolder)
    if (exists(posix.join(nested, projectConfigName))) return nested
  }
  return slashes(tool)
}

// The folder where the agent works. A project with its own `.git` or
// `package.json` is a project of its own: the host is the project. Else the
// nearest folder above the project that has `.git` and a `package.json` (the
// root of a repository with packages in sub folders, also when the command
// runs in one of them); with none, the nearest folder above it with one of
// the two; with none, the project. A `.git` with no `package.json` (a home
// folder that is a repository) is a host only when no folder below it has
// a `package.json`.
export function hostRoot(project: string, exists: Exists): string {
  const git = (folder: string) => exists(posix.join(folder, '.git'))
  const npm = (folder: string) => exists(posix.join(folder, 'package.json'))
  if (git(project) || npm(project)) return project
  let nearest: string | null = null
  for (let folder = parentOf(project); folder !== null; folder = parentOf(folder)) {
    if (git(folder) && npm(folder)) return folder
    if (nearest === null && (git(folder) || npm(folder))) nearest = folder
  }
  return nearest ?? project
}

// True when the tool is a package installed below `node_modules`. Its folder is
// then no project: the lookup that ends at the tool found no project.
export function isInstalled(tool: string): boolean {
  return slashes(tool).split('/').includes('node_modules')
}

// The message for a lookup that found no project, or null. The lookup ends at
// the tool when it finds no project: that is the project only when the
// command runs in the folder of the tool (standalone). An installed tool is
// never a project, and a clone of the tool run from a different folder (a
// host before `canvas init`) is not the project of that folder.
export function noProjectProblem(project: string, tool: string, cwd: string, fold: boolean = foldsCase): string | null {
  if (!samePath(project, tool, fold)) return null
  if (!isInstalled(tool) && isInside(slashes(cwd), slashes(tool), fold)) return null
  return `No canvas project was found from ${slashes(cwd)} upward (a ${projectConfigName}, or ${hostProjectFolder}/${projectConfigName}). Run canvas init in the host first, or name the project with --project <folder>.`
}

// The message for a host that `canvas init` and `canvas sync` must not write
// into, or null: the home folder, a folder above it (`/Users`), or the root of
// the file system. The lookup of
// the host goes upward with no bound, thus a folder with no `package.json`
// and no `.git` can give a home folder that is a repository.
export function hostProblem(host: string, home: string, fold: boolean = foldsCase): string | null {
  const folder = slashes(host)
  if (!isInside(slashes(home), folder, fold) && parentOf(folder) !== null) return null
  return `The host would be ${folder}: canvas init writes AGENTS.md and the skill folders there. Run the command in the folder of the host project (a folder with package.json or .git), or name the project with --project <folder>.`
}

// The path of the guide of the project, relative to the host root:
// `AGENTS.md` in standalone, `canvas/AGENTS.md` in a host.
export function guidePathOf(project: string, host: string): string {
  return posix.join(posix.relative(host, project), guideName)
}

// The path of `to` relative to the folder `from`, both absolute with `/`
// between the parts; `to` itself when the two are on different drives of
// Windows, which no relative path joins (`posix.relative` would give
// `../../D:/x`). A drive letter has no case (`c:` is `C:`).
export function relativePath(from: string, to: string): string {
  const drive = (path: string) => /^([A-Za-z]):/.exec(path)?.[1].toUpperCase() ?? ''
  const upper = (path: string) => (drive(path) === '' ? path : `${drive(path)}${path.slice(1)}`)
  return drive(from) === drive(to) ? posix.relative(upper(from), upper(to)) : to
}


// True when `path` is the folder `folder` or a path in it, with no regard to
// the case of the letters where the file system has none (`fold`).
export function isInside(path: string, folder: string, fold: boolean = foldsCase): boolean {
  const [x, y] = [slashes(path), slashes(folder)]
  const [inner, outer] = fold ? [x.toLowerCase(), y.toLowerCase()] : [x, y]
  return inner === outer || inner.startsWith(outer.endsWith('/') ? outer : `${outer}/`)
}

// True for a relative path that stays in its folder: not empty, no root (`/`,
// or `\` of Windows, also `\\server`), no drive of Windows, no `..`
// part (with `/` or `\` between the parts), and no NUL character, which no
// file name has.
export function isInnerPath(path: string): boolean {
  return path !== '' && !path.includes('\0') && !/^[\\/]/.test(path) && !/^[A-Za-z]:/.test(path) && !path.split(/[\\/]/).includes('..')
}

// A matcher of the file watcher: true for a cache of the dependency step in
// the work folder of the project (`.canvas/vite`, `.canvas/vite-editor`,
// `.canvas/vite-frame`). The dependency step writes many files there, and
// each would be an event of the watcher.
export function cacheMatcher(project: string, work: string): (path: string) => boolean {
  const prefix = `${posix.join(project, work)}/vite`
  return (path) => {
    const file = slashes(path)
    if (!file.startsWith(prefix)) return false
    const rest = file.slice(prefix.length)
    return /^(-[^/]*)?(\/|$)/.test(rest)
  }
}

// True when the path is a folder on the disk (a link to a folder counts).
export function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

// The text of a file, or null when it cannot be read.
export function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

// The message for a project folder that is not a folder, or null.
export function folderProblem(folder: string, folderTest: (path: string) => boolean = isFolder): string | null {
  return folderTest(folder) ? null : `The project folder ${folder} does not exist or is not a folder.`
}

// The project of this process: the variable (which the command sets), else the
// lookup from the current folder, else the tool. In the case of the disk
// (`diskCase`), as the command gives it, thus a run of Vite or of a script
// with no command compares the same paths as the file watcher.
export function currentProject(): string {
  return diskCase(projectRoot(null, process.env, diskCase(slashes(process.cwd())), toolRoot, existsSync))
}
