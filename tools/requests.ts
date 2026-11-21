// The pure parts of the local file API (`requests-plugin.ts`): the address of a
// call, the path of its file, the checks of a call, and the hash of a text.
//
// A request file and an issues file are in the work folder of the config:
// `.canvas/requests/<screen id>.json` and `.canvas/issues/<screen id>.json`.
// The API accepts only the ids of the list of screens, only valid content, and
// only calls from the same origin.

import { createHash } from 'node:crypto'
import { config } from '../canvas.config.ts'
import { apiPrefix, fileKinds, hashOfHeader, type FileKind } from '../src/requests/api.ts'
import {
  fileText,
  formatRequest,
  formatVersion,
  parseIssues,
  parseRequest,
  type IssuesFile,
  type RequestFile,
} from '../src/requests/format.ts'
import { messageOf } from '../src/tokens/format.ts'
import { folderPrefix, idInFolder, screenExtension } from './screens.ts'

// The folder of the temporary files of the writes, in the work folder.
export const tempName = 'tmp'

export type Route = { kind: FileKind; id: string; action: 'read' | 'write' }

function isKind(kind: string): kind is FileKind {
  return (fileKinds as readonly string[]).includes(kind)
}

// The absolute path of the file of a screen, or null when the kind is unknown
// or the id is not in the list of screens. An id with a `..` part gives null
// also when the list has it, thus a path never leaves its folder.
export function workPath(
  kind: string,
  id: string,
  ids: readonly string[],
  root: string,
  work: string = config.work,
): string | null {
  if (!isKind(kind) || !ids.includes(id) || id.split('/').includes('..')) return null
  return `${folderPrefix(root)}${folderPrefix(work)}${kind}/${id}.json`
}

// The kind, the id and the action of a call to the API, or null for each other
// address and method: `GET` and `PUT` on a request, `PUT` on issues. The id
// can have a slash, as is or as `%2F`.
export function routeOf(method: string | undefined, url: string | undefined): Route | null {
  if (!method || !url?.startsWith(apiPrefix)) return null
  const path = url.split(/[?#]/, 1)[0].slice(apiPrefix.length)
  const slash = path.indexOf('/')
  if (slash === -1) return null
  const kind = path.slice(0, slash)
  let id: string
  try {
    id = decodeURIComponent(path.slice(slash + 1))
  } catch {
    return null
  }
  if (!isKind(kind) || id === '') return null
  if (method === 'PUT') return { kind, id, action: 'write' }
  if (method === 'GET' && kind === 'requests') return { kind, id, action: 'read' }
  return null
}

// True for a call with no `Origin` header (a page of the same origin that
// reads, or a tool such as `curl`) and for a call from the page of this
// server. A different site in the browser of the user cannot read or write
// the files.
export function sameOrigin(headers: { origin?: string; host?: string }): boolean {
  if (headers.origin === undefined) return true
  if (!headers.host) return false
  try {
    return new URL(headers.origin).host === headers.host
  } catch {
    return false
  }
}

// A body that passed the checks: the checked file and its formatted text.
export type Accepted = { file: RequestFile | IssuesFile; text: string }

// Checks the body of a `PUT` and gives the checked file with the formatted
// text to write, or the error text for the answer. `id` is the screen of the
// address; the content must be of the same screen. The size is checked when
// the body is read.
export function acceptBody(kind: FileKind, text: string, id: string): Accepted | { error: string } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    return { error: `the content is not JSON: ${messageOf(error)}` }
  }
  try {
    const file = kind === 'requests' ? parseRequest(json) : parseIssues(json)
    if (file.screen !== id) return { error: `the content is of the screen "${file.screen}", not of "${id}"` }
    return { file, text: fileText(file) }
  } catch (error) {
    return { error: messageOf(error) }
  }
}

// The hash of a text, for the headers `ETag` and `If-Match`.
export function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

// True when `base` (the value of `If-Match`: a quoted hash) is the hash of
// `current`: the text on the disk, or the empty request when there is no file.
// A call with no base does not match.
export function baseMatches(base: string | undefined, current: string): boolean {
  return hashOfHeader(base) === hashOf(current)
}

// The text that a `GET` gives when a screen has no request file.
export function emptyRequest(id: string, screens: string = config.screens): string {
  const file = `${folderPrefix(screens)}${id}${screenExtension}`
  return formatRequest({ version: formatVersion, screen: id, file, edits: [] })
}

// The screen id of a request file, or null for each other path. `path` and
// `folder` (the requests folder) are absolute, with `/` between the parts.
export function requestIdOf(path: string, folder: string): string | null {
  const id = idInFolder(path, folder, '.json')
  return id === '' ? null : id
}
