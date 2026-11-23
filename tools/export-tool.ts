// Writes the clean tool into a new folder: `canvas export <folder>`. The
// command (`tools/cli.ts`) loads this file through the module runner of Vite,
// which strips the types. The rules of the export
// are in `export.ts`.

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { messageOf } from '../src/tokens/format.ts'
import { copyFiles, exportedFiles, exportReport, lockProblem, parseFileList, targetProblem } from './export.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const argument = process.argv[2]
if (!argument) {
  console.error('Name the target folder: npm run export -- <folder>')
  process.exit(1)
}

// `npm run` starts the script in the project root; a relative folder is
// relative to the folder in which the person ran the command.
const target = resolve(process.env.INIT_CWD ?? process.cwd(), argument)
const problem = targetProblem(target, root)
if (problem) {
  console.error(problem)
  process.exit(1)
}

const list = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
if (list.status !== 0) {
  console.error(`git ls-files failed: ${list.stderr || list.error?.message}`)
  process.exit(1)
}

const files = exportedFiles(parseFileList(list.stdout))
try {
  copyFiles(root, target, files)
} catch (error) {
  console.error(`The export stopped: ${messageOf(error)}`)
  process.exit(1)
}

// The exported files whose content on the disk differs from the last commit.
// With no commit yet, the count is 0.
const diff = spawnSync('git', ['diff', '--name-only', '-z', 'HEAD'], { cwd: root, encoding: 'utf8' })
const exported = new Set(files)
const changed = diff.status === 0 ? parseFileList(diff.stdout).filter((file) => exported.has(file)).length : 0

// The lock file of the project lists the packages of the pack; a new one is
// written for the export. This needs the registry.
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const lock = spawnSync(npm, ['install', '--package-lock-only', '--no-audit', '--no-fund'], {
  cwd: target,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
console.log('')
console.log(exportReport(target, files.length, lockProblem(lock), changed))
