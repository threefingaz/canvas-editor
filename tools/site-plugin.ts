// Build only: writes the entry of the prototype site as `index.html`.
//
// The build has one entry, `site.html` (see `vite.config.ts`). The plugin runs
// after the HTML step of Vite has written the entry into the bundle, deletes
// it there, and emits the same text again with the name from `siteFileName`.
// The addresses in the text stay valid: with `base: './'` they are relative,
// and the two names are in the same folder.

import type { Plugin } from 'vite'
import { siteFileName } from './site.ts'

export function sitePlugin(): Plugin {
  return {
    name: 'canvas-site',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const [name, file] of Object.entries(bundle)) {
        const fileName = siteFileName(name)
        if (fileName === name || file.type !== 'asset') continue
        delete bundle[name]
        this.emitFile({ type: 'asset', fileName, source: file.source })
      }
    },
  }
}
