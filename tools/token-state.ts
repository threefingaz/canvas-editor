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

import { isRecord } from '../src/tokens/format.ts'
import { packLibraryFolder, tokensEntryPath, type Pack, type PackState } from './pack.ts'

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

// Pure: the library folder of the pack that the token plugin watches,
// relative to the project root, or null when there is no pack.
export function watchedLibraryFolder(pack: Pack | null): string | null {
  return pack === null ? null : packLibraryFolder(pack)
}

// The tokens from the module of a token entry, which a dynamic import gives
// with no type. The function `tokens` may also give a promise of the list. An
// error names the entry when the module has no function `tokens`.
export async function entryTokens(module: unknown, path: string): Promise<unknown> {
  const value = isRecord(module) ? module.tokens : undefined
  if (typeof value !== 'function') throw new Error(`${path} must export a function tokens()`)
  return await value()
}
