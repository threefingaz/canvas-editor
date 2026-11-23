import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, test, vi } from 'vitest'

const created = vi.hoisted(() => ({ frameClose: vi.fn(async () => {}), calls: 0 }))

// The API of Vite, with a frame server that starts and an editor server that
// fails.
vi.mock('vite', () => ({
  createServer: vi.fn(async () => {
    created.calls += 1
    if (created.calls === 1) return { close: created.frameClose, middlewares: () => {} }
    throw new Error('the port is in use')
  }),
}))

const { createServers, frameMiddleware } = await import('./dev.ts')

type Answer = { status: number; location: string | null; next: boolean; frame: boolean }

function call(url: string, serves: boolean): Answer {
  const answer: Answer = { status: 0, location: null, next: false, frame: false }
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      if (name === 'Location') answer.location = value
    },
    end() {
      answer.status = res.statusCode
    },
  }
  const frame = () => (_req: IncomingMessage, _res: ServerResponse, next: () => void) => {
    answer.frame = true
    if (serves) res.end()
    else next()
  }
  const middleware = frameMiddleware(frame as never)
  middleware({ url } as IncomingMessage, res as unknown as ServerResponse, () => {
    answer.next = true
  })
  return answer
}

describe('frameMiddleware', () => {
  test('the old address of the site goes to the site below /__frame/', () => {
    expect(call('/site.html', true)).toMatchObject({ status: 302, location: '/__frame/site.html', frame: false })
    expect(call('/site.html?x=1', true)).toMatchObject({ status: 302, location: '/__frame/site.html?x=1' })
  })

  test('an address below /__frame/ goes to the frame server, with 404 when it does not serve it', () => {
    expect(call('/__frame/frame.html', true)).toMatchObject({ status: 200, frame: true, next: false })
    expect(call('/__frame/none', false)).toMatchObject({ status: 404, frame: true, next: false })
  })

  test('each other address goes on to the editor', () => {
    expect(call('/', true)).toMatchObject({ next: true, frame: false })
    expect(call('/index.html', true)).toMatchObject({ next: true, frame: false })
  })
})

describe('createServers', () => {
  test('closes the frame server when the editor server does not start', async () => {
    await expect(createServers({ port: null })).rejects.toThrow('the port is in use')
    expect(created.frameClose).toHaveBeenCalledTimes(1)
  })
})
