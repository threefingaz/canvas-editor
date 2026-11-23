// Writes the token file from the library pack: `canvas tokens`. The command
// (`tools/cli.ts`) loads this file through the module runner of Vite, which
// strips the types. The dev server runs the command too, after each change of
// a file in the library folder of the pack (`tokens-plugin.ts`). What it does
// for each pack state is decided in `token-state.ts`. The pack and the token
// file are those of the project (`project.ts`).

import { readFileSync, writeFileSync } from 'node:fs'
import { posix } from 'node:path'
import { pathToFileURL } from 'node:url'
import { config } from '../canvas.config.ts'
import { formatTokens, parseTokens, type Token } from '../src/tokens/format.ts'
import { readPackState } from './pack.ts'
import { currentProject } from './project.ts'
import { entryTokens, tokenAction, unknownField } from './token-state.ts'

const root = currentProject()
const action = tokenAction(readPackState(root), root, config.tokens)
if (action.kind === 'skip') {
  console.log(action.message)
  process.exit(0)
}
if (action.kind === 'fail') {
  console.error(action.message)
  process.exit(1)
}

// A dynamic import has no type: the tokens must pass the check that the editor
// does when it reads the file. The file keeps the fields in the sequence in
// which the pack builds each token; the check builds new objects.
const module: unknown = await import(/* @vite-ignore */ pathToFileURL(action.path).href)
const entry = await entryTokens(module, action.path)
const tokens = parseTokens({ tokens: entry })
// `parseTokens` leaves out a field that the format does not have; the file
// gets the entry as it is, thus such a field stops the script.
const extra = unknownField(entry as unknown[])
if (extra !== null) {
  console.error(`${action.path}: ${extra}.`)
  process.exit(1)
}
const text = formatTokens(entry as Token[])

function currentText(file: string): string | null {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

// A file with the same content is not written: each write updates the
// editor, and a change in the library folder often does not change a token.
const file = posix.join(root, config.tokens)
if (currentText(file) === text) {
  console.log(`${config.tokens}: ${tokens.length} tokens, no change`)
} else {
  writeFileSync(file, text)
  console.log(`${config.tokens}: ${tokens.length} tokens`)
}
