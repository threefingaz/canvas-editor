// The pure rule of the token script (`build-tokens.ts`) and of the token
// plugin (`tokens-plugin.ts`): what they do for each state of the library pack
// (`pack.ts`).
//
// One pack: the script loads the token entry of the pack
// (`packs/<name>/library/tokens.ts`, which exports `tokens(): Token[]`), and
// the plugin watches the library folder of the pack. No pack: the script
// writes no file and says so, with the exit code 0, and the plugin watches
// nothing. An error of the pack state: the script stops with the message and
// the exit code 1.

import { isRecord, textStyleParts } from '../src/tokens/format.ts'
import { posix } from 'node:path'
import { packLibraryFolder, sourceFolders, tokensEntryPath, type Pack, type PackState } from './pack.ts'

export type TokenAction =
  | { kind: 'load'; path: string }
  | { kind: 'skip'; message: string }
  | { kind: 'fail'; message: string }

// Pure: what the token script does for a pack state. `root` is the project
// root with `/` between the parts; `tokensFile` is the token file relative to
// it, for the messages.
export function tokenAction(state: PackState, root: string, tokensFile: string): TokenAction {
  switch (state.kind) {
    case 'one':
      return { kind: 'load', path: tokensEntryPath(state.pack, root) }
    case 'none':
      return { kind: 'skip', message: `no library is connected: ${tokensFile} is not written` }
    case 'error':
      return { kind: 'fail', message: `${tokensFile} is not written: ${state.message}` }
  }
}

// Pure: the folders that the token plugin watches, absolute with `/`: the
// library folder of the pack, and each folder source of the pack (a folder of
// the host, whose stylesheets or theme a token entry of level 2 can read).
// None with no pack. `project` and `host` are absolute with `/`.
export function watchedFolders(pack: Pack | null, project: string, host: string): string[] {
  if (pack === null) return []
  return [posix.join(project, packLibraryFolder(pack)), ...sourceFolders(pack, host)]
}

// The tokens from the module of a token entry, which a dynamic import gives
// with no type. The function `tokens` may also give a promise of the list. An
// error names the entry when the module has no function `tokens`.
export async function entryTokens(module: unknown, path: string): Promise<unknown> {
  const value = isRecord(module) ? module.tokens : undefined
  if (typeof value !== 'function') throw new Error(`${path} must export a function tokens()`)
  return await value()
}

// The fields of a token and of a media value of the token format
// (`parseTokens` in `src/tokens/format.ts`).
const tokenFields = new Set(['id', 'group', 'name', 'value', 'code', 'cssVar', 'factor', 'selector', 'media'])
const mediaFields = new Set(['query', 'value'])
const styleFields = new Set<string>(textStyleParts)

// The first part of a text style value that the format does not have, or
// undefined (also for a value that is not an object).
const extraPart = (value: unknown) => (isRecord(value) ? Object.keys(value).find((key) => !styleFields.has(key)) : undefined)

// Pure: the first field of the entry that the token format does not have (of
// a token, of a media value, or a part of a text style value), as
// `token <n> "<id>" has the field "<name>"`, or null. The script writes the
// tokens as the entry gives them (the sequence of the fields of the pack), thus
// a field that `parseTokens` leaves out would go into the file unchecked.
export function unknownField(entry: readonly unknown[]): string | null {
  for (const [index, token] of entry.entries()) {
    if (!isRecord(token)) continue
    const label = `token ${index + 1}${typeof token.id === 'string' ? ` "${token.id}"` : ''}`
    const field = Object.keys(token).find((key) => !tokenFields.has(key))
    if (field !== undefined) return `${label} has the field "${field}", which the token format does not have`
    const part = extraPart(token.value)
    if (part !== undefined) return `${label} has a text style with the part "${part}", which the token format does not have`
    const media = Array.isArray(token.media) ? token.media : []
    for (const value of media) {
      const extra = isRecord(value) ? Object.keys(value).find((key) => !mediaFields.has(key)) : undefined
      if (extra !== undefined) return `${label} has a media value with the field "${extra}", which the token format does not have`
      const inner = isRecord(value) ? extraPart(value.value) : undefined
      if (inner !== undefined) return `${label} has a media value whose text style has the part "${inner}", which the token format does not have`
    }
  }
  return null
}
