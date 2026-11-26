import { EventEmitter } from 'node:events'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ViteDevServer } from 'vite'
import { afterEach, describe, expect, test } from 'vitest'
import { packPlugin } from './pack-plugin.ts'

let root = ''
afterEach(() => {
  if (root !== '') rmSync(root, { recursive: true, force: true })
  root = ''
})

// A plain server: a watcher, a logger, and a restart that the test ends.
function fakeServer() {
  const restarts: ((worked: boolean) => void)[] = []
  const logger = { info: () => {}, error: () => {} }
  const server = {
    config: { logger },
    watcher: new EventEmitter(),
    restart: () =>
      new Promise<void>((resolve) => {
        restarts.push((worked) => {
          // A restart that worked puts the parts of the new server in.
          if (worked) server.watcher = new EventEmitter()
          resolve()
        })
      }),
  }
  return { server, restarts }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('packPlugin', () => {
  test('reads the packs again after a restart that failed when a change came during it', async () => {
    root = mkdtempSync(join(tmpdir(), 'canvas-pack-plugin-'))
    mkdirSync(join(root, 'packs/kit/library'), { recursive: true })
    writeFileSync(join(root, 'packs/kit/pack.json'), JSON.stringify({ name: 'kit', sources: ['@acme/kit'] }))
    writeFileSync(join(root, 'packs/kit/library/provider.tsx'), 'export {}')
    const { server, restarts } = fakeServer()
    const watcher = server.watcher
    const configure = packPlugin(null, root).configureServer as (server: ViteDevServer) => void
    configure(server as unknown as ViteDevServer)
    const manifest = join(root, 'packs/kit/pack.json')

    watcher.emit('all', 'change', manifest)
    expect(restarts).toHaveLength(1)
    // A change during the restart starts no second one at once.
    watcher.emit('all', 'change', manifest)
    expect(restarts).toHaveLength(1)
    restarts[0](false)
    await tick()
    expect(restarts).toHaveLength(2)
    // A restart that worked: the new server has its own plugin.
    watcher.emit('all', 'change', manifest)
    restarts[1](true)
    await tick()
    expect(restarts).toHaveLength(2)
  })
})
