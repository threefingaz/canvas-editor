// Development only: writes the token file again when the library changes.
//
// The token file comes from the library pack (`build-tokens.ts`). The script
// imports the library folder of the pack, thus a change there can change the
// tokens. After each change of a code file there, the plugin runs the
// command `canvas tokens` (`bin/canvas.js`) in a new Node process: a new
// process imports the changed files, not the ones that it loaded before. The editor reads the token file through the
// dev server (`src/editor/tokens/editor-tokens.ts`) and gets the new tokens
// when the file is written; the script writes nothing when the tokens are the
// same.
//
// The changes that start a run are code files of the library folder, not test
// files (`token-writes.ts`). One run at a time: a change during a run starts
// one more run after it (`run-queue.ts`). An error of the script shows in the
// output of the dev server, and the server keeps running. When the server
// closes (also for a restart), the run stops and no queued run starts.
//
// The plugin also gives the editor the text of the token file of the project
// as `virtual:canvas-tokens` (`screen-modules.ts`), and updates that module
// when the file is written, added or removed: the module of the editor that
// imports it (`src/editor/tokens/editor-tokens.ts`) takes the new text with no
// reload. It runs in the editor server only.

import { spawn, type ChildProcess } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePath, type Logger, type Plugin } from 'vite'
import { config } from '../canvas.config.ts'
import type { Pack } from './pack.ts'
import { diskCase, hostProblem, isInside, readText, toolRoot } from './project.ts'
import { createRunQueue } from './run-queue.ts'
import { tokensModuleCode, tokensModuleId } from './screen-modules.ts'
import { watchedFolders } from './token-state.ts'
import { writesTokens } from './token-writes.ts'
import { fileEvent } from './watch.ts'

const command = fileURLToPath(new URL('../bin/canvas.js', import.meta.url))
const resolvedTokensId = `\0${tokensModuleId}`

function lastLine(text: string): string {
  return text.trim().split('\n').at(-1) ?? ''
}

// The result of one run of the script: an error text for a failure, and the
// output.
type RunResult = { error?: string; output: string }

// `project` is the project root (`project.ts`): the command writes its token
// file from its pack. `host` is the host root: a folder source of the pack is
// relative to it.
export function tokensPlugin(pack: Pack | null, project: string, host: string): Plugin {
  const root = normalizePath(project)
  const tokenFile = normalizePath(join(root, config.tokens))
  let logger: Logger | null = null
  // A closed server (a restart, the end of the command) starts no run, stops
  // the one that runs, and reports nothing: the next server has its own.
  let closed = false
  let current: ChildProcess | null = null

  const start = (finish: (result: RunResult) => void) => {
    if (closed) return finish({ output: '' })
    let output = ''
    const child = spawn(process.execPath, [command, 'tokens', '--project', root], { cwd: root })
    current = child
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')))
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')))
    child.on('error', (error) => {
      if (current === child) current = null
      finish({ error: error.message, output })
    })
    child.on('close', (code, signal) => {
      if (current === child) current = null
      if (code === 0) finish({ output })
      else finish({ error: signal ? `signal ${signal}` : `exit code ${code}`, output })
    })
  }

  const report = ({ error, output }: RunResult) => {
    if (closed) return
    if (error === undefined) {
      logger?.info(`token file: ${lastLine(output)}`, { timestamp: true })
    } else {
      logger?.error(`token file: the script failed (${error})\n${output.trim()}`, { timestamp: true })
    }
  }

  const run = createRunQueue(start, report)

  return {
    name: 'canvas-tokens',
    apply: 'serve',
    resolveId(id) {
      if (id === tokensModuleId) return resolvedTokensId
    },
    load(id) {
      if (id === resolvedTokensId) return tokensModuleCode(readText(tokenFile))
    },
    closeBundle() {
      closed = true
      current?.kill()
    },
    hotUpdate({ file }) {
      if (this.environment.name !== 'client' || normalizePath(file) !== tokenFile) return
      const module = this.environment.moduleGraph.getModuleById(resolvedTokensId)
      if (!module) return []
      this.environment.moduleGraph.invalidateModule(module)
      return [module]
    },
    configureServer(server) {
      logger = server.config.logger
      // The library folder of the pack (`packs/<name>/library`) and its
      // folder sources in the host. With no pack there is no library to
      // watch, and the plugin does nothing. A folder outside the project and
      // the tool is added to the file watcher. In the case of the disk
      // (`diskCase`), as the watcher gives each path: a folder source of the
      // manifest can be written in a different case.
      const folders = watchedFolders(pack, root, normalizePath(host)).map(diskCase)
      if (folders.length === 0) return
      // A folder that is the home folder or the root of the file system
      // (`hostProblem`) is not watched: the watcher would read each file there.
      const home = homedir()
      for (const folder of folders) {
        if (!isInside(folder, root) && !isInside(folder, toolRoot) && hostProblem(folder, home) === null) server.watcher.add(folder)
      }
      server.watcher.on('all', (event, file) => {
        if (fileEvent(event) && writesTokens(normalizePath(file), folders)) run()
      })
    },
  }
}
