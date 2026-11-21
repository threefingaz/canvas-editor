import { apiPrefix, hashOfHeader, quotedHash } from '../../requests/api.ts'
import {
  formatIssues,
  formatRequest,
  parseRequest,
  type IssuesFile,
  type RequestFile,
} from '../../requests/format.ts'
import { messageOf } from '../../tokens/format.ts'

// The calls of the editor to the local file API of the dev server
// (`tools/requests-plugin.ts`). A call never throws: an error of the network,
// of the server or of the content gives a result with the error text.

export type Loaded = { status: 'loaded'; file: RequestFile; hash: string } | { status: 'error'; error: string }

// `conflict`: the file on the disk is not the base of the call. The result has
// its current content, and nothing was written.
export type Saved =
  | { status: 'saved'; file: RequestFile; hash: string }
  | { status: 'conflict'; file: RequestFile; hash: string }
  | { status: 'error'; error: string }

export type IssuesSaved = { status: 'saved' } | { status: 'error'; error: string }

export type RequestsClient = {
  loadRequest: (id: string) => Promise<Loaded>
  // `base`: the hash of the text that the editor loaded or wrote last.
  saveRequest: (file: RequestFile, base: string) => Promise<Saved>
  saveIssues: (file: IssuesFile) => Promise<IssuesSaved>
}

const addressOf = (kind: 'requests' | 'issues', id: string) => `${apiPrefix}${kind}/${encodeURIComponent(id)}`

// The text of an answer that is not a success.
async function failure(response: Response): Promise<string> {
  const text = (await response.text().catch(() => '')).trim()
  return `${response.status}${text === '' ? '' : ` ${text}`}`
}

// The request file and its hash in an answer with content.
async function content(response: Response): Promise<{ file: RequestFile; hash: string }> {
  const hash = hashOfHeader(response.headers.get('ETag'))
  if (hash === null) throw new Error('the answer has no ETag')
  return { file: parseRequest(JSON.parse(await response.text())), hash }
}

function put(address: string, body: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(address, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
    cache: 'no-store',
  })
}

export const requestsClient: RequestsClient = {
  loadRequest: async (id) => {
    try {
      const response = await fetch(addressOf('requests', id), { cache: 'no-store' })
      if (!response.ok) return { status: 'error', error: await failure(response) }
      return { status: 'loaded', ...(await content(response)) }
    } catch (error) {
      return { status: 'error', error: messageOf(error) }
    }
  },
  saveRequest: async (file, base) => {
    try {
      const response = await put(addressOf('requests', file.screen), formatRequest(file), { 'If-Match': quotedHash(base) })
      if (response.status === 409) return { status: 'conflict', ...(await content(response)) }
      if (!response.ok) return { status: 'error', error: await failure(response) }
      return { status: 'saved', ...(await content(response)) }
    } catch (error) {
      return { status: 'error', error: messageOf(error) }
    }
  },
  saveIssues: async (file) => {
    try {
      const response = await put(addressOf('issues', file.screen), formatIssues(file))
      if (!response.ok) return { status: 'error', error: await failure(response) }
      return { status: 'saved' }
    } catch (error) {
      return { status: 'error', error: messageOf(error) }
    }
  },
}
