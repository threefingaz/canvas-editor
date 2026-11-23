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

// The module of the tool for the state "no library", relative to the folder
// of the tool.
export const noLibraryFile = 'src/frame/no-library.tsx'

export type LibraryModule = { kind: 'module'; path: string } | { kind: 'error'; message: string }

// Pure: the absolute path of the module to load for the pack (null: no pack),
// or an error when the pack has no provider. `project` is the project root
// and `tool` the folder of the tool, with `/` between the parts; `exists`
// tells whether a file exists.
export function libraryModule(
  pack: Pack | null,
  project: string,
  tool: string,
  exists: (path: string) => boolean,
): LibraryModule {
  if (pack === null) return { kind: 'module', path: posix.join(tool, noLibraryFile) }
  const path = providerPath(pack, project)
  if (!exists(path)) return { kind: 'error', message: noProviderMessage(pack, project) }
  return { kind: 'module', path }
}
