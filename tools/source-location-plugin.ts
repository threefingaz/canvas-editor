// Development only: adds the place in the code to each JSX element of the
// screen files (see `source-location.ts`). The production build has no
// `data-loc-*` attribute. Register it before the React plugin.
//
// The library package comes from the manifest of the library pack, which the
// Vite config reads once (`pack.ts`). With no pack, no import has the origin
// `library`.

import type { Plugin } from 'vite'
import { config } from '../canvas.config.ts'
import type { Pack } from './pack.ts'
import { addSourceLocations, screenModuleFile } from './source-location.ts'

export function sourceLocationPlugin(pack: Pack | null): Plugin {
  let root = process.cwd()
  const libraryPackage = pack === null ? null : pack.package

  return {
    name: 'canvas-source-location',
    apply: 'serve',
    enforce: 'pre',
    configResolved(resolved) {
      root = resolved.root
    },
    transform(code, id) {
      const file = screenModuleFile(id, root, config.screens)
      return file === null ? undefined : addSourceLocations(code, file, libraryPackage, id)
    },
  }
}
