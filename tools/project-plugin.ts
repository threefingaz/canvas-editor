// Development only: the file watcher of the dev server watches the project.
//
// The watcher of Vite watches its root, the folder of the tool. A project in
// a different folder (`--project`, a host with `canvas/`) is added here, thus
// each plugin gets the events of a new screen, a request file, a
// `flow.json`, the pack and the token entry there. In standalone the project
// is the root, and nothing is added.

import type { Plugin } from 'vite'
import { isInside, toolRoot } from './project.ts'

export function projectPlugin(project: string): Plugin {
  return {
    name: 'canvas-project',
    apply: 'serve',
    configureServer(server) {
      if (!isInside(project, toolRoot)) server.watcher.add(project)
    },
  }
}
