// Build only: writes the entry of the prototype site as `index.html`.
//
// The build has one entry, `site.html` (see `vite.config.ts`). A static host
// serves `index.html` for the address of a folder, thus the built entry gets
// that name, and the site opens at the address of its folder. The plugin runs
// after the HTML step of Vite has written the entry into the bundle, deletes
// it there, and emits the same text again as `index.html`. The addresses in
// the text stay valid: with `base: './'` they are relative, and the two names
// are in the same folder.

import type { Plugin } from 'vite'
import { siteEntry } from '../src/site/entry.ts'

// The entry of the site in the project root (`src/site/entry.ts`), and its
// name in the built folder.
export { siteEntry }
export const siteIndex = 'index.html'

export function sitePlugin(): Plugin {
  return {
    name: 'canvas-site',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const entry = bundle[siteEntry]
      if (entry?.type !== 'asset') return
      delete bundle[siteEntry]
      this.emitFile({ type: 'asset', fileName: siteIndex, source: entry.source })
    },
  }
}
