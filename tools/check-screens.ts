// Checks the screen files: `npm run check`, or `npm run check -- <screen>…`
// with ids or paths of screens. Node runs this file directly. It prints the
// findings and exits with 1 when there is one. With no library pack it says
// so, and has no finding of the kind `not-library`. Its decisions are in
// `check.ts`.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../canvas.config.ts'
import { checkReport, checkScreens, screenArgument } from './check.ts'
import { packOf, readPackState } from './pack.ts'
import { readScreenFiles } from './screens-plugin.ts'
import { screenList } from './screens.ts'

const root = fileURLToPath(new URL('..', import.meta.url)).replaceAll('\\', '/')

let libraryPackage: string | null = null
let scaleKeys: string[] | null = null
try {
  const pack = packOf(readPackState(root))
  libraryPackage = pack?.package ?? null
  scaleKeys = pack?.scaleKeys ?? null
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

const files = readScreenFiles(root, join(root, config.screens))
const entries = screenList(files)
const only: string[] = []
for (const argument of process.argv.slice(2)) {
  const id = screenArgument(argument, entries)
  if (id === null) {
    console.error(`No screen has the id or the file '${argument}'.`)
    process.exit(1)
  }
  only.push(id)
}

if (libraryPackage === null) {
  console.log('No library is connected: the check cannot tell an element of the library from a different one. It has no finding of the kind not-library.')
}
const isComponent = (path: string) => ['.tsx', '.jsx', '/index.tsx', '/index.jsx'].some((end) => existsSync(join(root, path + end)))
const result = checkScreens(files, { libraryPackage, scaleKeys, only, isComponent })
console.log(checkReport(result))
// Not `process.exit`: it can cut a long report that goes through a pipe.
process.exitCode = result.findings.length > 0 ? 1 : 0
