// The module of the wrapper of a screen: `virtual:canvas-library`. The frame
// imports `LibraryProvider` from it and knows nothing about a library.
//
// With a pack, the module is the provider of the pack
// (`packs/<name>/library/provider.tsx`). With no pack, it is a small module of
// the tool that says that no library is connected (`src/frame/no-library.tsx`).

import { posix } from 'node:path'
import { noProviderMessage, providerPath, type Pack } from './pack.ts'

// The id that the frame imports.
export const libraryModuleId = 'virtual:canvas-library'

// The module of the tool for the state "no library", relative to the root.
export const noLibraryFile = 'src/frame/no-library.tsx'

export type LibraryModule = { kind: 'module'; path: string } | { kind: 'error'; message: string }

// Pure: the absolute path of the module to load for the pack (null: no pack),
// or an error when the pack has no provider. `root` is the project root with
// `/` between the parts; `exists` tells whether a file exists.
export function libraryModule(pack: Pack | null, root: string, exists: (path: string) => boolean): LibraryModule {
  if (pack === null) return { kind: 'module', path: posix.join(root, noLibraryFile) }
  const path = providerPath(pack, root)
  if (!exists(path)) return { kind: 'error', message: noProviderMessage(pack, root) }
  return { kind: 'module', path }
}
