// Development only: restarts the dev server when the library pack changes.
//
// The Vite config reads the pack once (`pack.ts`) and gives it to the
// plugins. When a pack folder, a manifest `packs/*/pack.json` or the provider
// of a pack is added, changed or removed, this plugin reads the pack state
// again. A different pack restarts the server: the config and each plugin read
// the new pack, and the pages reload when the server is back. A new pack with
// no provider yet waits for it. An error of the new state (two packs, a
// manifest that is not valid) shows in the output of the dev server, and the
// server keeps the pack that it has until the files are fixed. A restart that
// failed keeps this server and reads the pack state again when a change came
// during it; else the next change tries again.

import { existsSync } from 'node:fs'
import { normalizePath, type Plugin } from 'vite'
import { messageOf } from '../src/tokens/format.ts'
import { packChange, packErrorText, providerPath, readPackState, touchesPackState, type Pack } from './pack.ts'
import { fileEvent } from './watch.ts'

// `project` is the project root (`project.ts`): the packs are in its `packs/`.
// `label` names the server in the output: `canvas dev` has two (the dev
// server of the editor and the frame server), and each one restarts itself.
export function packPlugin(pack: Pack | null, project: string, label = 'dev server'): Plugin {
  return {
    name: 'canvas-pack',
    apply: 'serve',
    configureServer(server) {
      const root = normalizePath(project)
      const logger = server.config.logger
      const hasProvider = (next: Pack) => existsSync(providerPath(next, root))
      // One restart for a burst of events (a folder and its manifest). A
      // restart that worked closes this watcher, and the new server has a new
      // instance of this plugin; a restart that failed keeps this server, thus
      // the flag goes back and the next change tries again.
      let restarting = false
      // An event of the packs that came during a restart: a restart that
      // failed reads the state again, thus a later write is not lost.
      let missed = false
      // The message shown last, to show each message once.
      let shown = ''
      const check = () => {
        const change = packChange(pack, readPackState(root), root, hasProvider)
        if (change.kind === 'error' || change.kind === 'wait') {
          const text = packErrorText(change.message)
          if (change.message !== shown) {
            if (change.kind === 'error') logger.error(text, { timestamp: true })
            else logger.info(text, { timestamp: true })
          }
          shown = change.message
        } else if (change.kind === 'same') {
          shown = ''
        } else {
          restarting = true
          missed = false
          shown = ''
          logger.info(`canvas library: the library pack changed, the ${label} restarts`, { timestamp: true })
          // A restart that worked puts the parts of the new server into this
          // one (a new watcher); one that failed logs it and keeps them.
          const watcher = server.watcher
          const done = () => {
            restarting = false
            if (missed && server.watcher === watcher) check()
          }
          server.restart().then(done, (error: unknown) => {
            logger.error(`canvas library: the restart failed: ${messageOf(error)}`, { timestamp: true })
            done()
          })
        }
      }
      server.watcher.on('all', (event, file) => {
        if (!fileEvent(event) && event !== 'addDir' && event !== 'unlinkDir') return
        if (!touchesPackState(normalizePath(file), root)) return
        if (restarting) missed = true
        else check()
      })
    },
  }
}
