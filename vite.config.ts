import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { libraryPlugin } from './tools/library-plugin.ts'
import { packOf, readPackState } from './tools/pack.ts'
import { packPlugin } from './tools/pack-plugin.ts'
import { requestsPlugin } from './tools/requests-plugin.ts'
import { screensPlugin } from './tools/screens-plugin.ts'
import { siteEntry, sitePlugin } from './tools/site-plugin.ts'
import { sourceLocationPlugin } from './tools/source-location-plugin.ts'
import { tokensPlugin } from './tools/tokens-plugin.ts'

// Three entries in the dev server: `index.html` is the editor (at `/`),
// `frame.html` is one screen in a frame of the canvas, `site.html` is the
// prototype site. The build has only the site: the editor and the frame need
// the dev server (the element-to-code step and the file API). The site plugin
// writes the built `site.html` as `index.html`.
const input = {
  site: fileURLToPath(new URL(`./${siteEntry}`, import.meta.url)),
}

// The library pack (`packs/<name>/`), read once and given to each plugin that
// needs it; null when no library is connected. An error of the pack state (two
// packs, a manifest that is not valid) stops the server or the build. The pack
// plugin restarts the dev server when the pack changes, and the config is
// read again.
const pack = packOf(readPackState(fileURLToPath(new URL('.', import.meta.url))))

// https://vite.dev/config/
export default defineConfig({
  // The source location step runs before the React plugin (dev server only).
  // The requests plugin is the local file API of the editor (dev server only).
  // The tokens plugin writes the token file again after a change in the
  // library folder (dev server only). The library plugin gives the frame and
  // the site the wrapper of the library pack (dev server and build). The pack
  // plugin restarts the dev server when the pack changes (dev server only).
  // The site plugin writes the entry of the site as `index.html` (build only).
  plugins: [
    sourceLocationPlugin(pack),
    react(),
    tailwindcss(),
    screensPlugin(pack),
    libraryPlugin(pack),
    requestsPlugin(),
    tokensPlugin(pack),
    packPlugin(pack),
    sitePlugin(),
  ],
  // Relative addresses in the built site, thus its folder works at each
  // address of a static host, also in a sub folder. The dev server serves
  // from `/` all the same.
  base: './',
  build: {
    rolldownOptions: { input },
  },
  // The dev server finds the packages to prepare in the three entries. With no
  // list here it reads only the input of the build, the site, and finds the
  // packages of the editor when the editor first loads: it then prepares them
  // and reloads the page.
  optimizeDeps: {
    entries: ['index.html', 'frame.html', siteEntry],
  },
})
