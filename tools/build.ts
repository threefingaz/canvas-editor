// `canvas build` and `canvas preview`, through the JavaScript API of Vite.
// The build runs a type check first (`typeCheckOf`) and writes the site only
// when it passes.

import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, posix } from 'node:path'
import { build, preview } from 'vite'
import { configFile, serverOptions, type ServeOptions } from './dev.ts'
import { currentProject, distFolder, slashes, toolRoot, type Exists } from './project.ts'

// The path of the `tsc` script of the TypeScript package of the tool: `bin.tsc`
// of its `package.json` (the package exports no path of its bin).
export function tscPath(packageFile: string, packageText: string): string {
  const path: unknown = JSON.parse(packageText).bin?.tsc
  if (typeof path !== 'string') throw new Error(`${packageFile} names no tsc script.`)
  return join(dirname(packageFile), path)
}

// The build empties `dist/` of the project. In a host, a `dist/` that has
// files and no site of the tool (an `index.html` that loads `assets/site-…`)
// belongs to something else: the build refuses it. `entries` are the names in
// the folder (null with no folder), `index` the text of its `index.html`.
export function distProblem(dist: string, standalone: boolean, entries: readonly string[] | null, index: string | null): string | null {
  if (standalone || entries === null || entries.length === 0) return null
  if (index?.includes('./assets/site-')) return null
  return `The folder ${dist} has files that are not a site of canvas build, and the build would delete them. Move them, or name a different project folder with --project.`
}

function readEntries(folder: string): string[] | null {
  try {
    return readdirSync(folder)
  } catch {
    return null
  }
}

function readIndex(folder: string): string | null {
  try {
    return readFileSync(join(folder, 'index.html'), 'utf8')
  } catch {
    return null
  }
}

// The type check of the build, with the TypeScript of the tool: the arguments
// of `tsc` and the folder to run it in, or null for no type check.
//
// - The project is the tool itself (standalone): `tsc -b`, all code of the
//   tool, the pack and the screens, as the npm script did.
// - A project outside the tool with a `tsconfig.json`: that file, with
//   `--noEmit`, thus the check never writes a file into the host.
// - A project with no `tsconfig.json`: no type check. The code of the tool is
//   not checked in a host: it can lack the development packages there.
export type TypeCheck = { args: string[]; cwd: string }

export function typeCheckOf(project: string, tool: string, exists: Exists): TypeCheck | null {
  if (slashes(project) === slashes(tool)) return { args: ['-b'], cwd: tool }
  const tsconfig = posix.join(slashes(project), 'tsconfig.json')
  if (!exists(tsconfig)) return null
  return { args: ['-p', tsconfig, '--noEmit'], cwd: slashes(project) }
}

// The line that the build prints before the build of Vite, thus its output
// says whether the type check ran: with no type check, why; after a type
// check that passed, the command of `tsc` (`tsc -b` for the tool, or `tsc -p`
// with the `tsconfig.json` of the project). A type check that fails prints the
// errors of `tsc`, and the build stops.
export function typeCheckLine(check: TypeCheck | null, project: string): string {
  if (check === null) return `The project has no tsconfig.json: no type check (${project}).`
  return `The type check passed: tsc ${check.args.join(' ')}${check.args[0] === '-b' ? ` (all code of the tool, in ${check.cwd})` : ''}.`
}

function typeCheck(): Promise<number> {
  const project = currentProject()
  const check = typeCheckOf(project, toolRoot, existsSync)
  if (check === null) {
    console.log(typeCheckLine(null, project))
    return Promise.resolve(0)
  }
  const packageFile = createRequire(import.meta.url).resolve('typescript/package.json')
  const tsc = tscPath(packageFile, readFileSync(packageFile, 'utf8'))
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [tsc, ...check.args], { cwd: check.cwd, stdio: 'inherit' })
    child.on('error', (error) => {
      console.error(`The type check did not start: ${error.message}`)
      resolve(1)
    })
    child.on('close', (code) => {
      if (code === 0) console.log(typeCheckLine(check, project))
      resolve(code ?? 1)
    })
  })
}

export async function buildSite(): Promise<number> {
  const project = currentProject()
  const dist = posix.join(project, distFolder)
  const problem = distProblem(dist, slashes(project) === toolRoot, readEntries(dist), readIndex(dist))
  if (problem !== null) {
    console.error(problem)
    return 1
  }
  const code = await typeCheck()
  if (code !== 0) return code
  await build({ configFile, root: toolRoot })
  return 0
}

export async function previewSite(options: ServeOptions): Promise<void> {
  const server = await preview({ configFile, root: toolRoot, preview: serverOptions(options) })
  server.printUrls()
  server.bindCLIShortcuts({ print: true })
}
