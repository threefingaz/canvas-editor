// Development only: adds the place in the code to each JSX element of the
// screen files (see `source-location.ts`). The production build has no
// `data-loc-*` attribute. Register it before the React plugin.
//
// The sources of the library come from the manifest of the library pack,
// which the Vite config reads once (`pack.ts`): its packages, and its folders
// of code of the host. With no pack, no import has the origin `library`.
// `project` is the project root and `host` the host root (`project.ts`), with
// `/` between the parts: the screens are in the screens folder of the
// project, and a folder of the manifest is relative to the host.

import type { Plugin } from 'vite'
import { config } from '../canvas.config.ts'
import { librarySources, type Pack } from './pack.ts'
import { addSourceLocations, screenModuleFile } from './source-location.ts'

export function sourceLocationPlugin(pack: Pack | null, project: string, host: string): Plugin {
  const library = pack === null ? null : librarySources(pack, project, host)
  // The keys of the scales of the pack: a number under a different key of a
  // size marks its element as one that sets a value.
  const scale = pack?.scaleKeys ? new Set(pack.scaleKeys) : null

  return {
    name: 'canvas-source-location',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      const file = screenModuleFile(id, project, config.screens)
      return file === null ? undefined : addSourceLocations(code, file, library, id, scale)
    },
  }
}
