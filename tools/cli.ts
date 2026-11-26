// The command of the tool: `canvas <command>`. `bin/canvas.js` loads this
// module through the module runner of Vite (Node does not strip the types of a
// file below `node_modules`) and calls `main` with the arguments.
//
// `commandOf` reads the arguments (pure). `dev`, `build` and `preview` call
// the JavaScript API of Vite (`dev.ts`, `build.ts`); `init`, `sync`, `agents`
// and `status` are functions (`init.ts`, `status.ts`). `check`, `tokens` and
// `export` are scripts that do their work when they load: `main` loads each
// one through the module runner, with the arguments of the command in
// `process.argv`.
//
// The project (`project.ts`) is found once, here (`dispatchOf`, pure):
// `--project`, then the variable `CANVAS_PROJECT`, then the lookup from the
// current folder, then the tool. `main` sets the variable to the folder that
// it found, thus the Vite config, each script and each child process read the
// same project.

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'
import { buildSite, previewSite } from './build.ts'
import { dev } from './dev.ts'
import { agentsCommand, initCommand, initProject, syncCommand } from './init.ts'
import { diskCase, folderProblem, hostProblem, hostRoot, isFolder, noProjectProblem, projectRoot, projectVariable, slashes, toolRoot, type Exists } from './project.ts'
import { toolAliases } from './react-resolve.ts'
import { statusCommand } from './status.ts'

export const commands = ['dev', 'build', 'preview', 'check', 'tokens', 'status', 'init', 'sync', 'agents', 'export'] as const
export type CommandName = (typeof commands)[number]

// One command: its name, the project folder of `--project` (null with none),
// the port of `--port` (null with none), the library of `--library` (null
// with none), and the other arguments.
export type Command = { name: CommandName; project: string | null; port: number | null; library: string | null; args: string[] }

export type Parsed = { kind: 'command'; command: Command } | { kind: 'help' } | { kind: 'error'; message: string }

// The commands that take arguments: the screens to check, the folder of the
// export. `--port` is for the two commands that serve.
const takesArgs: readonly CommandName[] = ['check', 'export']
const takesPort: readonly CommandName[] = ['dev', 'preview']
// The commands that read a project. `export` works on the tool itself.
const takesProject: readonly CommandName[] = commands.filter((name) => name !== 'export')
// The command that takes `--library`.
const takesLibrary: readonly CommandName[] = ['init']

function isCommand(name: string): name is CommandName {
  return (commands as readonly string[]).includes(name)
}

function portOf(text: string): number | null {
  if (!/^\d+$/.test(text)) return null
  const port = Number(text)
  return port >= 1 && port <= 65535 ? port : null
}

// The command of the arguments (with no `node` and no path of the script).
// Each argument after `--` is an argument of the command, also when it starts
// with `--`: `npm run check -- a` gives `check a`, `npx canvas check -- a`
// gives `check -- a`, and the two are the same command.
export function commandOf(args: readonly string[]): Parsed {
  const [name, ...rest] = args
  if (name === undefined || name === 'help' || name === '--help' || name === '-h') return { kind: 'help' }
  if (!isCommand(name)) {
    return { kind: 'error', message: `Unknown command '${name}'. The commands: ${commands.join(', ')}.` }
  }
  const command: Command = { name, project: null, port: null, library: null, args: [] }
  for (let index = 0; index < rest.length; index++) {
    const argument = rest[index]
    if (argument === '--') {
      command.args.push(...rest.slice(index + 1))
      break
    }
    const option = /^--(project|port|library)(?:=(.*))?$/.exec(argument)
    if (option !== null) {
      const value = option[2] ?? rest[++index]
      if (value === undefined || value === '') return { kind: 'error', message: `The option --${option[1]} needs a value.` }
      if (option[1] === 'project') {
        if (!takesProject.includes(name)) return { kind: 'error', message: `The command ${name} takes no --project: it works on the tool.` }
        command.project = value
        continue
      }
      if (option[1] === 'library') {
        if (!takesLibrary.includes(name)) return { kind: 'error', message: `The command ${name} takes no --library.` }
        command.library = value
        continue
      }
      if (!takesPort.includes(name)) return { kind: 'error', message: `The command ${name} takes no --port.` }
      const port = portOf(value)
      if (port === null) return { kind: 'error', message: `The port '${value}' is not a number from 1 to 65535.` }
      command.port = port
      continue
    }
    if (argument.startsWith('-')) return { kind: 'error', message: `Unknown option '${argument}' of the command ${name}.` }
    command.args.push(argument)
  }
  if (command.args.length > 0 && !takesArgs.includes(name)) {
    return { kind: 'error', message: `The command ${name} takes no arguments: ${command.args.join(' ')}.` }
  }
  return { kind: 'command', command }
}

export const usage = `Usage: canvas <command> [options]

Commands:
  dev                   start the editor and the site (the dev server)
  build                 type check, then build the prototype site into dist/
  preview               serve the built site from dist/
  check [<screen>…]     check the screen files; with no screen, all
  tokens                write tokens.json from the library pack
  status                the state of the project: the library, the tokens,
                        the screens, the check, the guide, and the next step
  init                  set up a project: in a host, canvas/ with the pack of
                        its library, a copy of the guide, the stubs of the
                        skills and a block in AGENTS.md; in the tool, the pack
  sync                  copy the guide again, and write the stubs and the block
  agents                write the stubs of the skills
  export <folder>       write the clean tool into a new or empty folder

Options:
  --port <number>       the port of dev or preview; the command fails when it is in use
  --library <library>   the library of init: an npm package (in the tool with a
                        range, @mui/material@^9), or a folder of the host
                        (./src/ui); with none, the one dependency of the host
                        with React as a peer dependency
  --project <folder>    the folder of the project (each command but export);
                        with none, the variable CANVAS_PROJECT, then the
                        nearest folder upward with canvas.config.ts or
                        canvas/canvas.config.ts, then the folder of the tool.
                        For init with none: the tool in the tool repository,
                        else canvas/ of the host of the current folder
`

// The script of each command that runs as a script.
const scripts: Partial<Record<CommandName, string>> = {
  check: 'check-screens.ts',
  tokens: 'build-tokens.ts',
  export: 'export-tool.ts',
}

export function scriptOf(name: CommandName): string | null {
  return scripts[name] ?? null
}

// The values of the process that `dispatchOf` reads.
export type DispatchDeps = {
  env: Readonly<Record<string, string | undefined>>
  cwd: string
  tool: string
  home: string
  exists: Exists
  isFolder: (path: string) => boolean
}

export type Dispatch = { kind: 'fail'; message: string } | { kind: 'run'; project: string }

// The commands that write into the host root: the stubs of the skills, the
// block, and for init the project.
const writesHost: readonly CommandName[] = ['init', 'sync', 'agents']

// The project of a command, or why it cannot run (pure):
//
// - `init` finds its project with `initProject`, because the folder may not
//   exist yet.
// - `export` works on the tool: no project is checked.
// - A folder that the user named (`--project`, `CANVAS_PROJECT`) must be a
//   folder. A folder of the lookup is one; a lookup that ended at the tool
//   outside its folder found no project (`noProjectProblem`).
// - `init`, `sync` and `agents` refuse a host that is the home folder or the
//   root of the file system (`hostProblem`).
export function dispatchOf(command: Command, deps: DispatchDeps): Dispatch {
  const { env, cwd, tool, exists } = deps
  const named = command.project !== null || (env[projectVariable] ?? '') !== ''
  const project =
    command.name === 'init' ? initProject(command.project, env, cwd, tool, exists) : projectRoot(command.project, env, cwd, tool, exists)
  if (takesProject.includes(command.name) && command.name !== 'init') {
    const problem = named ? folderProblem(project, deps.isFolder) : noProjectProblem(project, tool, cwd)
    if (problem !== null) return { kind: 'fail', message: problem }
  }
  if (writesHost.includes(command.name)) {
    const problem = hostProblem(hostRoot(project, exists), deps.home)
    if (problem !== null) return { kind: 'fail', message: problem }
  }
  return { kind: 'run', project }
}

// Runs the command of the arguments; gives the exit code. A command that
// serves (`dev`, `preview`) gives 0 when the server listens, and the process
// runs on.
export async function main(args: readonly string[]): Promise<number> {
  const parsed = commandOf(args)
  if (parsed.kind === 'help') {
    console.log(usage)
    return 0
  }
  if (parsed.kind === 'error') {
    console.error(`${parsed.message}\n\n${usage}`)
    return 1
  }
  const { command } = parsed
  // The current folder in the case of the disk, as the project and the tool
  // (`diskCase`): each relative path between them is then right.
  const cwd = diskCase(slashes(process.cwd()))
  const dispatch = dispatchOf(command, { env: process.env, cwd, tool: toolRoot, home: homedir(), exists: existsSync, isFolder })
  if (dispatch.kind === 'fail') {
    console.error(dispatch.message)
    return 1
  }
  const project = diskCase(dispatch.project)
  if (command.name === 'init') return initCommand(toolRoot, project, command.library, cwd)
  process.env[projectVariable] = project
  switch (command.name) {
    case 'dev':
      await dev({ port: command.port })
      return 0
    case 'build':
      return buildSite()
    case 'preview':
      await previewSite({ port: command.port })
      return 0
    case 'status':
      return statusCommand(project, toolRoot)
    case 'sync':
      return syncCommand(toolRoot, project)
    case 'agents':
      return agentsCommand(toolRoot, project)
  }
  const script = scriptOf(command.name)
  if (script === null) throw new Error(`The command ${command.name} has no script.`)
  const path = fileURLToPath(new URL(`./${script}`, import.meta.url))
  // The script reads its arguments from `process.argv`, as when Node runs it.
  process.argv = [process.argv[0], path, ...command.args]
  // The token entry of a pack imports the token module of the tool by its
  // name (`toolAliases`).
  await runnerImport(path, { resolve: { alias: toolAliases(toolRoot) } })
  return typeof process.exitCode === 'number' ? process.exitCode : 0
}
