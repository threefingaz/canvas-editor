// `canvas dev`: the dev server of the editor, the frames and the site,
// through the JavaScript API of Vite. Its decisions are in `serverOptions`
// and in `react-resolve.ts`.
//
// Two servers on one origin (`react-resolve.ts`): the editor server listens
// on the port, and the frame server runs in middleware mode below `/__frame/`
// of it, with the React of the project. The config is the one of the tool
// (`vite.config.ts`, its folder is the root of Vite) for the two; the frame
// server has the mode `frameMode`, which gives it the role `frame`. No config
// file of a different folder is read. A restart of a server (the pack plugin
// of each one) reads the config file again, thus a new pack is found, and
// keeps the mode and the options here.
//
// The hot updates of the frame server go over the HTTP server of the editor
// server: the frame server gets `upgrades` as its server of web sockets, and
// the editor server gives each upgrade request of its HTTP server to it. The
// frame server takes only the ones of its own address (`/__frame/`), the
// editor server only the ones of `/`. A restart of the editor server makes a
// new HTTP server, and the plugin gives its upgrades again.

import { EventEmitter } from 'node:events'
import type { Server as HttpServer } from 'node:http'
import { posix } from 'node:path'
import { createServer, type Connect, type Plugin, type ViteDevServer } from 'vite'
import { toolRoot } from './project.ts'
import { frameMode, frameRoute } from './react-resolve.ts'

// The Vite config of the tool.
export const configFile = posix.join(toolRoot, 'vite.config.ts')

export type ServeOptions = { port: number | null }

// The server options of a port: with a port, the command fails when that port
// is in use (a different port would not be the one that the user named); with
// none, Vite takes its default and the next free one.
export function serverOptions({ port }: ServeOptions): { port?: number; strictPort?: boolean } {
  return port === null ? {} : { port, strictPort: true }
}

// The middleware of the editor server for the addresses of the frame server:
// `/site.html` sends the browser to the site below `/__frame/`, and each
// `/__frame/` address goes to the frame server (`frame`, read at each request:
// a restart of the frame server keeps that object), with 404 for one that it
// does not serve. Each other address goes on.
export function frameMiddleware(frame: () => Connect.Server): Connect.NextHandleFunction {
  return (req, res, next) => {
    const route = frameRoute(req.url ?? '/')
    if (route === null) return next()
    if (route.kind === 'site') {
      res.statusCode = 302
      res.setHeader('Location', route.location)
      res.end()
      return
    }
    // An address below `/__frame/` that the frame server does not serve is not
    // an address of the editor either.
    frame()(req, res, () => {
      res.statusCode = 404
      res.end()
    })
  }
}

// The plugin of the editor server that gives the frame server its addresses
// and its upgrade requests.
function frameMount(frame: ViteDevServer, upgrades: EventEmitter): Plugin {
  return {
    name: 'canvas-frame-mount',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(frameMiddleware(() => frame.middlewares))
      server.httpServer?.on('upgrade', (req, socket, head) => upgrades.emit('upgrade', req, socket, head))
    },
  }
}

// The servers of `canvas dev`: the editor server, which listens, and the
// frame server below it. `close` closes the two.
export type Servers = { editor: ViteDevServer; frame: ViteDevServer; close: () => Promise<void> }

export async function createServers(options: ServeOptions): Promise<Servers> {
  const upgrades = new EventEmitter()
  const frame = await createServer({
    configFile,
    root: toolRoot,
    mode: frameMode,
    appType: 'mpa',
    server: { middlewareMode: true, ws: { server: upgrades as unknown as HttpServer } },
  })
  let editor: ViteDevServer
  try {
    editor = await createServer({
      configFile,
      root: toolRoot,
      server: serverOptions(options),
      plugins: [frameMount(frame, upgrades)],
    })
  } catch (error) {
    await frame.close()
    throw error
  }
  const close = async () => {
    await Promise.all([editor.close(), frame.close()])
  }
  return { editor, frame, close }
}

export async function dev(options: ServeOptions): Promise<Servers> {
  const servers = await createServers(options)
  try {
    await servers.editor.listen()
  } catch (error) {
    await servers.close()
    throw error
  }
  servers.editor.printUrls()
  servers.editor.bindCLIShortcuts({ print: true })
  return servers
}
