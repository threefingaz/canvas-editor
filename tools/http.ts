// The parts of an answer of the dev server that the file API
// (`requests-plugin.ts`) and the agent (`agent-plugin.ts`) share: the type of
// a handler, a plain text answer, and the middleware that turns an error of a
// handler into 500.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { messageOf } from '../src/tokens/format.ts'

// An async handler of the dev server: it answers, or calls `next`.
export type Handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>

// An answer of plain text, never kept in a cache.
export function sendText(res: ServerResponse, status: number, text: string, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(`${text}\n`)
}

// The middleware of a handler: an error that the handler throws gives 500
// with its message, when the answer has not started yet.
export function guarded(handle: Handler): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  return (req, res, next) => {
    handle(req, res, next).catch((error: unknown) => {
      if (res.headersSent) return
      sendText(res, 500, messageOf(error))
    })
  }
}
