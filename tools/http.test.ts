import { describe, expect, test } from 'vitest'
import { guarded, sendText } from './http.ts'

describe('guarded', () => {
  function response(sent = false) {
    const res = { headersSent: sent, status: 0, body: '', writeHead(status: number) { res.status = status }, end(text: string) { res.body = text } }
    return res
  }

  test('an error of the handler gives 500 with its message', async () => {
    const res = response()
    guarded(async () => {
      throw new Error('EACCES: permission denied')
    })({} as never, res as never, () => {})
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(res).toMatchObject({ status: 500, body: 'EACCES: permission denied\n' })
  })

  test('an answer that started stays as it is', async () => {
    const res = response(true)
    guarded(async () => {
      throw new Error('late')
    })({} as never, res as never, () => {})
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(res).toMatchObject({ status: 0, body: '' })
  })
})

describe('sendText', () => {
  test('a plain text with no cache, and the headers of the call', () => {
    const got = { status: 0, headers: {} as Record<string, string>, body: '' }
    const res = {
      writeHead(status: number, headers: Record<string, string>) {
        got.status = status
        got.headers = headers
      },
      end(text: string) {
        got.body = text
      },
    }
    sendText(res as never, 405, 'no', { Allow: 'GET' })
    expect(got).toEqual({
      status: 405,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', Allow: 'GET' },
      body: 'no\n',
    })
  })
})
