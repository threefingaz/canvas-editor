// Writes the token file from the library pack: `npm run tokens`.
// Node runs this file directly; it strips the types. The dev server runs it
// too, after each change of a file in the library folder of the pack
// (`tokens-plugin.ts`). What it does for each pack state is decided in
// `token-state.ts`.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { config } from '../canvas.config.ts'
import { formatTokens, parseTokens, type Token } from '../src/tokens/format.ts'
import { readPackState } from './pack.ts'
import { entryTokens, tokenAction } from './token-state.ts'

const root = fileURLToPath(new URL('..', import.meta.url)).replaceAll('\\', '/')
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
const module: unknown = await import(pathToFileURL(action.path).href)
const entry = await entryTokens(module, action.path)
const tokens = parseTokens({ tokens: entry })
const text = formatTokens(entry as Token[])

function currentText(file: URL): string | null {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

// A file with the same content is not written: each write updates the
// editor, and a change in the library folder often does not change a token.
const file = new URL(`../${config.tokens}`, import.meta.url)
if (currentText(file) === text) {
  console.log(`${config.tokens}: ${tokens.length} tokens, no change`)
} else {
  writeFileSync(file, text)
  console.log(`${config.tokens}: ${tokens.length} tokens`)
}
