// Development only: writes the token file again when the library changes.
//
// The token file comes from the library pack (`build-tokens.ts`). The script
// imports the library folder of the pack, thus a change there can change the
// tokens. After each change of a code file there, the plugin runs the
// script in a new Node process: a new process imports the changed files, not
// the ones that it loaded before. The editor reads the token file through the
// dev server (`src/editor/tokens/editor-tokens.ts`) and gets the new tokens
// when the file is written; the script writes nothing when the tokens are the
// same.
//
// The changes that start a run are code files of the library folder, not test
// files (`token-writes.ts`). One run at a time: a change during a run starts
// one more run after it (`run-queue.ts`). An error of the script shows in the
// output of the dev server, and the server keeps running.

import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePath, type Logger, type Plugin } from 'vite'
import type { Pack } from './pack.ts'
import { createRunQueue } from './run-queue.ts'
import { watchedLibraryFolder } from './token-state.ts'
import { writesTokens } from './token-writes.ts'
import { fileEvent } from './watch.ts'

const script = fileURLToPath(new URL('./build-tokens.ts', import.meta.url))

function lastLine(text: string): string {
  return text.trim().split('\n').at(-1) ?? ''
}

// The result of one run of the script: an error text for a failure, and the
// output.
type RunResult = { error?: string; output: string }

export function tokensPlugin(pack: Pack | null): Plugin {
  let root = normalizePath(process.cwd())
  let logger: Logger | null = null

  const start = (finish: (result: RunResult) => void) => {
    let output = ''
    // The flag lets Node before 22.18 run a TypeScript file; a later Node
    // takes it and needs it no more.
    const child = spawn(process.execPath, ['--experimental-strip-types', script], { cwd: root })
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')))
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')))
    child.on('error', (error) => finish({ error: error.message, output }))
    child.on('close', (code, signal) => {
      if (code === 0) finish({ output })
      else finish({ error: signal ? `signal ${signal}` : `exit code ${code}`, output })
    })
  }

  const report = ({ error, output }: RunResult) => {
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
    configResolved(resolved) {
      root = normalizePath(resolved.root)
    },
    configureServer(server) {
      logger = server.config.logger
      // The library folder of the pack (`packs/<name>/library`). With no pack
      // there is no library to watch, and the plugin does nothing.
      const libraryFolder = watchedLibraryFolder(pack)
      if (libraryFolder === null) return
      const folder = normalizePath(join(root, libraryFolder))
      server.watcher.on('all', (event, file) => {
        if (fileEvent(event) && writesTokens(normalizePath(file), folder)) run()
      })
    },
  }
}
