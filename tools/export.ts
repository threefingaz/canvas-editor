// The export of the clean tool: a copy of the tracked files with no library
// pack, no screens, no lock file and no finished plans (`npm run export --
// <folder>`, `export-tool.ts`). The result is the tool in the state "no
// library", for a person who connects a library of their own.
//
// The lock file is left out because it lists the packages of the pack; the
// command writes a new one for the result. The plans in `docs/plans/` are the
// history of the work. The empty folders `packs/` and `screens/` keep their
// tracked placeholder file, thus they exist in a new clone.
//
// The copy takes the content of each tracked file from the working tree, as
// it is on the disk: a change that is not committed goes into the export, and
// a file that Git does not track does not. The report says how many exported
// files have changes that are not committed.

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { config } from '../canvas.config.ts'
import { connectSentence } from '../src/frame/library-setup.ts'
import { packsFolder } from './pack.ts'

// The folders whose files are left out, relative to the project root.
export const leftOutFolders = [packsFolder, config.screens, 'docs/plans']

// The files that are left out, relative to the project root.
export const leftOutFiles = ['package-lock.json']

// The tracked empty files that keep the empty folders in the export.
export const placeholders = [`${packsFolder}/.gitkeep`, `${config.screens}/.gitkeep`]

// Pure: the files of the export, from the tracked files (paths relative to the
// project root, with `/`). The sequence is sorted.
export function exportedFiles(tracked: string[]): string[] {
  return tracked
    .filter(
      (file) =>
        placeholders.includes(file) ||
        (!leftOutFiles.includes(file) && !leftOutFolders.some((folder) => file.startsWith(`${folder}/`))),
    )
    .sort()
}

// Pure: the list of `git ls-files -z`, whose names end with a NUL character.
export function parseFileList(output: string): string[] {
  return output.split('\0').filter((file) => file !== '')
}

// Why the target folder cannot take the export, or null when it can: it does
// not exist yet, or it is an empty folder, and it is not in the project
// (`root`), where the lint and the dev server would read it.
export function targetProblem(target: string, root: string): string | null {
  const path = relative(root, target)
  if (path === '' || (!path.startsWith('..') && !isAbsolute(path))) {
    return `${target} is in the project: choose a folder outside ${root}`
  }
  if (!existsSync(target)) return null
  if (!statSync(target).isDirectory()) return `${target} is not a folder`
  if (readdirSync(target).length > 0) return `${target} is not empty: choose a new or an empty folder`
  return null
}

// Copies each file from `source` to `target` (both folders; `files` relative
// to them, with `/`), with the folders that it needs. `target` does not exist
// or is empty (`targetProblem`). A file that is missing in `source` stops the
// copy before it starts; an error during the copy removes what it wrote, thus
// the target can take the export again.
export function copyFiles(source: string, target: string, files: string[]): void {
  const missing = files.filter((file) => !existsSync(join(source, file)))
  if (missing.length > 0) {
    throw new Error(
      `tracked files are missing on the disk: ${missing.join(', ')}. Restore them or commit their removal, then export again`,
    )
  }
  const existed = existsSync(target)
  try {
    for (const file of files) {
      const to = join(target, file)
      mkdirSync(dirname(to), { recursive: true })
      copyFileSync(join(source, file), to)
    }
  } catch (error) {
    if (existed) {
      for (const name of readdirSync(target)) rmSync(join(target, name), { recursive: true, force: true })
    } else {
      rmSync(target, { recursive: true, force: true })
    }
    throw error
  }
}

// The result of the run of `npm install --package-lock-only`, as
// `spawnSync` gives it.
export type LockRun = { status: number | null; signal: string | null; error?: Error }

// Pure: why the run wrote no lock file, or null when it ended well.
export function lockProblem(run: LockRun): string | null {
  if (run.error) return `npm could not start (${run.error.message})`
  if (run.status === 0) return null
  const end = run.status === null ? `the signal ${run.signal ?? 'unknown'}` : `the exit code ${run.status}`
  return `npm install --package-lock-only ended with ${end} (its output is above)`
}

// Pure: what the command prints at the end, with what a person does next in
// the exported folder. `lockFailure` is why no lock file is written, or null
// when it is written; `changed` is the count of exported files with changes
// that are not committed.
export function exportReport(target: string, count: number, lockFailure: string | null, changed: number): string {
  const lock =
    lockFailure === null
      ? 'A new package-lock.json is written.'
      : `No package-lock.json is written: ${lockFailure}. \`npm install\` in that folder writes it.`
  const lines = [`The clean tool is in ${target}: ${count} files, with no library.`, lock]
  if (changed > 0) {
    lines.push(
      `${changed} exported ${changed === 1 ? 'file has' : 'files have'} changes that are not committed; the export has them as they are on the disk.`,
    )
  }
  return [
    ...lines,
    '',
    'Next, in that folder:',
    '  npm install',
    '  npm run init -- --library <package>@<range>',
    '  npm install',
    '  npm run dev',
    'Then:',
    '  1. Connect a library: the two commands in the middle do it (the npm package of the components, for example @mui/material@^9).',
    '     Or give the agent this sentence, and it runs them:',
    `       ${connectSentence}`,
    '     npm run status says the level of the library and the next step.',
    '  2. Create a screen: ask the agent for the screen; it follows the skill canvas-screen, which AGENTS.md names.',
    '  3. Build the site: npm run build writes it into dist/, and npm run preview serves it.',
  ].join('\n')
}
