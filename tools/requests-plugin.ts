// Development only: the local file API of the editor. The editor reads and
// writes the request file of a screen, and writes its issues file, through
// these addresses (see `requests.ts` and `src/requests/api.ts`):
//
// - `GET /__canvas/requests/<id>`: the request file, or an empty request when
//   there is no file.
// - `PUT /__canvas/requests/<id>`: writes the request file; a request with no
//   edits deletes it. The header `If-Match` carries the hash of the text that
//   the editor loaded or wrote last; when the file on the disk is different,
//   the answer is 409 with the current content, and nothing is written.
// - `PUT /__canvas/issues/<id>`: writes the issues file.
// - `POST /__canvas/screens`: one screen action (`screen-ops.ts`): a move in
//   the row, a new title, a rename, a delete into the trash, or a restore. The
//   answer has the plan that ran, or the refusals with 409.
// - `GET /__canvas/trash`: the deleted screens in the trash.
//
// Each answer with content has the hash of the content in the header `ETag`.
// A file is written to a temporary file in the work folder and then renamed,
// thus an agent never reads half a file.
//
// An agent changes the request files too. The plugin sends the event
// `canvas:request-changed` with the screen id to the editor when a request
// file changes, is added or is removed. A change in the work folder never
// reloads the editor or a frame.

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { normalizePath, type Plugin } from 'vite'
import { config } from '../canvas.config.ts'
import {
  apiPrefix,
  bodyLimit,
  quotedHash,
  requestChangedEvent,
  type ActionAnswer,
  type FileKind,
  type TrashAnswer,
} from '../src/requests/api.ts'
import { messageOf } from '../src/tokens/format.ts'
import {
  acceptBody,
  baseMatches,
  emptyRequest,
  hashOf,
  requestIdOf,
  parseScreenAction,
  routeOf,
  sameOrigin,
  screensRouteOf,
  tempName,
  workPath,
} from './requests.ts'
import {
  applyPlan,
  diskReader,
  planDelete,
  planRename,
  planReorder,
  planRestore,
  planTitle,
  trashItems,
  type Plan,
} from './screen-ops.ts'
import { screenNames } from './screens-plugin.ts'
import { folderPrefix, screenExtension } from './screens.ts'
import { fileEvent } from './watch.ts'

function sendText(res: ServerResponse, status: number, text: string) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(`${text}\n`)
}

function sendContent(res: ServerResponse, status: number, text: string) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ETag: quotedHash(hashOf(text)),
  })
  res.end(text)
}

function sendJson(res: ServerResponse, status: number, value: ActionAnswer | TrashAnswer) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(`${JSON.stringify(value)}\n`)
}

function tooLarge(res: ServerResponse) {
  res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8', Connection: 'close' })
  res.end(`the content is more than ${bodyLimit / 1024 / 1024} MB\n`)
}

// The text of the body, or null when it is more than the limit: then the
// answer is sent and the reading stops.
function readBody(req: IncomingMessage, res: ServerResponse): Promise<string | null> {
  if (Number(req.headers['content-length']) > bodyLimit) {
    tooLarge(res)
    return Promise.resolve(null)
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const onData = (chunk: Buffer) => {
      size += chunk.length
      if (size <= bodyLimit) {
        chunks.push(chunk)
        return
      }
      req.off('data', onData)
      req.pause()
      tooLarge(res)
      resolve(null)
    }
    req.on('data', onData)
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

let tempCount = 0

function writeFile(path: string, text: string, tempFolder: string) {
  mkdirSync(tempFolder, { recursive: true })
  mkdirSync(dirname(path), { recursive: true })
  tempCount += 1
  const temp = join(tempFolder, `${process.pid}-${Date.now()}-${tempCount}.json`)
  writeFileSync(temp, text)
  renameSync(temp, path)
}

// The work folder of the project at `root`, or a folder in it: the folder of
// a kind of file, or the folder of the temporary files. With `/` between the
// parts.
function workFolderOf(root: string, part: FileKind | typeof tempName | '' = ''): string {
  return normalizePath(join(root, config.work, part))
}

function isJson(contentType: string | undefined): boolean {
  return contentType?.split(';', 1)[0].trim().toLowerCase() === 'application/json'
}

export type HandlerDeps = {
  // The project root, with `/` between the parts.
  root: string
  // The widths of a frame of the project; the widths of the tool when not
  // given.
  widths?: readonly number[]
  // The ids of the screens of the list.
  screenIds: () => readonly string[]
  // The time of a delete; the clock when not given.
  now?: () => Date
}

export type Handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>

// The middleware of the file API. The checks of a call come in this sequence:
// the address (404), the origin (403), the screen (404), and for a `PUT` the
// content type (415), the size (413), the content (400), and for a request
// the header `If-Match` (428) and the base (409). A screen action has the
// address (404), the origin (403), the content type (415), the size (413), the
// action (400), the screen (404), and the refusals of its plan (409).
export function createRequestsHandler({ root, widths = config.widths, screenIds, now = () => new Date() }: HandlerDeps): Handler {
  const screens = async (req: IncomingMessage, res: ServerResponse, kind: 'action' | 'trash') => {
    if (!sameOrigin({ origin: req.headers.origin, host: req.headers.host })) {
      sendText(res, 403, 'only the editor of this server can use this address')
      return
    }
    const reader = diskReader(root)
    if (kind === 'trash') {
      sendJson(res, 200, { items: trashItems(reader) })
      return
    }
    if (!isJson(req.headers['content-type'])) {
      sendText(res, 415, 'the content type must be application/json')
      return
    }
    const body = await readBody(req, res)
    if (body === null) return
    const action = parseScreenAction(body)
    if ('error' in action) {
      sendText(res, 400, action.error)
      return
    }
    if (action.action !== 'restore' && !screenIds().includes(action.screen)) {
      sendText(res, 404, `no screen "${action.screen}"`)
      return
    }
    let plan: Plan
    switch (action.action) {
      case 'reorder':
        plan = planReorder(reader, action.screen, action.to, widths)
        break
      case 'title':
        plan = planTitle(reader, action.screen, action.title, widths)
        break
      case 'rename':
        plan = planRename(reader, action.screen, { flow: action.flow, name: action.name }, widths)
        break
      case 'delete':
        plan = planDelete(reader, action.screen, now(), widths)
        break
      case 'restore':
        plan = planRestore(reader, action.folder, widths)
        break
    }
    let result: ReturnType<typeof applyPlan>
    try {
      result = applyPlan(root, plan)
    } catch (error) {
      // A step failed; `applyPlan` put back the steps before it.
      sendText(res, 500, `the action failed, and the files are as before: ${messageOf(error)}`)
      return
    }
    if (!result.applied) {
      sendJson(res, 409, { applied: false, refusals: result.refusals })
      return
    }
    const { screens: changes, linkedBy, moves, writes, removes } = plan
    sendJson(res, 200, {
      applied: true,
      plan: { action: plan.action, screen: plan.screen, screens: changes, linkedBy, moves, writes: writes.map((write) => write.path), removes },
    })
  }

  return async function handle(req, res, next) {
    const screensRoute = screensRouteOf(req.method, req.url)
    if (screensRoute !== null) {
      await screens(req, res, screensRoute)
      return
    }
    const route = routeOf(req.method, req.url)
    if (!route) {
      if (req.url?.startsWith(apiPrefix)) sendText(res, 404, 'no such address or method')
      else next()
      return
    }
    if (!sameOrigin({ origin: req.headers.origin, host: req.headers.host })) {
      sendText(res, 403, 'only the editor of this server can use this address')
      return
    }
    const path = workPath(route.kind, route.id, screenIds(), root)
    if (path === null) {
      sendText(res, 404, `no screen "${route.id}"`)
      return
    }

    if (route.action === 'read') {
      sendContent(res, 200, readText(path) ?? emptyRequest(route.id))
      return
    }

    if (!isJson(req.headers['content-type'])) {
      sendText(res, 415, 'the content type must be application/json')
      return
    }
    const body = await readBody(req, res)
    if (body === null) return
    // A screen action (a delete, a rename) can take the screen while the body
    // comes in: a write for it then would leave a file of an old id, which
    // stops a later restore.
    if (workPath(route.kind, route.id, screenIds(), root) === null) {
      sendText(res, 404, `no screen "${route.id}"`)
      return
    }
    const accepted = acceptBody(route.kind, body, route.id)
    if ('error' in accepted) {
      sendText(res, 400, accepted.error)
      return
    }

    const tempFolder = workFolderOf(root, tempName)
    if (route.kind === 'issues') {
      writeFile(path, accepted.text, tempFolder)
      sendContent(res, 200, accepted.text)
      return
    }

    const base = req.headers['if-match']
    if (!base) {
      sendText(res, 428, 'a request needs the header If-Match with the hash of its base')
      return
    }
    const current = readText(path) ?? emptyRequest(route.id)
    if (!baseMatches(base, current)) {
      sendContent(res, 409, current)
      return
    }
    if ('edits' in accepted.file && accepted.file.edits.length === 0) {
      rmSync(path, { force: true })
      sendContent(res, 200, emptyRequest(route.id))
      return
    }
    writeFile(path, accepted.text, tempFolder)
    sendContent(res, 200, accepted.text)
  }
}

// The project root (with `/` between the parts) and the widths of its config.
export type RequestsOptions = { project: string; widths: readonly number[] }

export function requestsPlugin({ project, widths }: RequestsOptions): Plugin {
  const root = normalizePath(project)

  const screensFolder = () => normalizePath(join(root, config.screens))
  const screenIds = () => screenNames(screensFolder()).map((name) => name.slice(0, -screenExtension.length))
  const handle = createRequestsHandler({ root, widths, screenIds })

  return {
    name: 'canvas-requests',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handle(req, res, next).catch((error: unknown) => {
          if (res.headersSent) return
          sendText(res, 500, messageOf(error))
        })
      })

      const requestsFolder = workFolderOf(root, 'requests')
      server.watcher.on('all', (event, file) => {
        if (!fileEvent(event)) return
        const id = requestIdOf(normalizePath(file), requestsFolder)
        if (id !== null) server.environments.client.hot.send(requestChangedEvent, { id })
      })
    },
    hotUpdate: {
      // Before the other plugins: a file in the work folder is not a module of
      // a page, and no page reloads for it.
      order: 'pre',
      handler({ file }) {
        if (normalizePath(file).startsWith(folderPrefix(workFolderOf(root)))) return []
      },
    },
  }
}
