// The virtual module `virtual:canvas-library`: the wrapper of a screen, from
// the library pack, or the message of the tool when no library is connected
// (`library.ts`). It runs in the dev server and in the build.
//
// The Vite config reads the pack once and gives it to the plugin. A pack with
// no provider stops the server or the build with the message.

import { existsSync } from 'node:fs'
import { normalizePath, type Plugin } from 'vite'
import { libraryModule, libraryModuleId } from './library.ts'
import type { Pack } from './pack.ts'

export function libraryPlugin(pack: Pack | null): Plugin {
  let path = ''

  return {
    name: 'canvas-library',
    configResolved(resolved) {
      const module = libraryModule(pack, normalizePath(resolved.root), existsSync)
      if (module.kind === 'error') throw new Error(`canvas library: ${module.message}`)
      path = module.path
    },
    resolveId(id) {
      if (id === libraryModuleId) return path
    },
  }
}
