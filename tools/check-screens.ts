// Checks the screen files: `canvas check`, or `canvas check -- <screen>…`
// with ids or paths of screens. The command (`tools/cli.ts`) loads this file
// through the module runner of Vite. It prints the
// findings and exits with 1 when there is one. With no library pack it says
// so, and has no finding of the kind `not-library`. Its decisions are in
// `check.ts`. The screens, the pack and the widths are those of the project
// (`project.ts`, `project-config.ts`); each path is relative to the project.

import { existsSync } from 'node:fs'
import { config } from '../canvas.config.ts'
import { messageOf } from '../src/tokens/format.ts'
import { checkProject, checkReport, readProjectScreens, screenArgument } from './check.ts'
import type { LibrarySources } from './jsx.ts'
import { librarySources, packOf, readPackState } from './pack.ts'
import { readProjectSettings } from './project-config.ts'
import { currentProject, diskCase, hostRoot, slashes } from './project.ts'

const root = currentProject()

let library: LibrarySources | null = null
let scaleKeys: string[] | null = null
let widths: readonly number[] = config.widths
try {
  const pack = packOf(readPackState(root))
  library = pack === null ? null : librarySources(pack, root, hostRoot(root, existsSync))
  scaleKeys = pack?.scaleKeys ?? null
  widths = (await readProjectSettings(root)).widths
} catch (error) {
  console.error(messageOf(error))
  process.exit(1)
}

const screens = readProjectScreens(root, config.screens, widths)
const entries = screens.entries
const only: string[] = []
for (const argument of process.argv.slice(2)) {
  const id = screenArgument(argument, entries, { cwd: diskCase(slashes(process.cwd())), project: slashes(root), real: diskCase })
  if (id === null) {
    console.error(`No screen has the id or the file '${argument}'.`)
    process.exit(1)
  }
  only.push(id)
}

if (library === null) {
  console.log('No library is connected: the check cannot tell an element of the library from a different one. It has no finding of the kind not-library.')
}
const result = checkProject(root, screens, { library, scaleKeys, only, widths })
console.log(checkReport(result))
// Not `process.exit`: it can cut a long report that goes through a pipe.
process.exitCode = result.findings.length > 0 ? 1 : 0
