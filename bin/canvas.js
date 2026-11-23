#!/usr/bin/env node
// The command of the tool: `canvas <command>`; `canvas help` lists the
// commands. Plain JavaScript, thus Node runs it also below `node_modules`,
// where Node does not strip the types of a TypeScript file. It loads
// `tools/cli.ts` through the module runner of Vite and calls `main`.
//
// `vite` is resolved from the folder of this file, thus from the tool: npm
// can put the packages of the tool below its own `node_modules`, not in the
// one of the host project.

import { fileURLToPath } from 'node:url'

/** @type {typeof import('vite')} */
let vite
try {
  vite = await import('vite')
} catch (error) {
  console.error(`The tool finds no vite package next to it: run npm install in the folder of the tool or of the project.\n${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

// An error of a command (a port in use, a pack that is not valid) shows as
// its message, with no stack; `CANVAS_DEBUG=1` shows the stack too.
const cli = fileURLToPath(new URL('../tools/cli.ts', import.meta.url))
try {
  /** @type {{ module: { main: (args: string[]) => Promise<number> } }} */
  const { module } = await vite.runnerImport(cli)
  process.exitCode = await module.main(process.argv.slice(2))
} catch (error) {
  const debug = process.env.CANVAS_DEBUG === '1'
  console.error(error instanceof Error ? (debug ? error.stack ?? error.message : error.message) : String(error))
  process.exitCode = 1
}
