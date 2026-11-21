// The local file API of the dev server (`tools/requests-plugin.ts`): the
// addresses, the limit of a body, and the event that tells the editor about a
// request file that changed. The editor and the plugin both import this
// module, thus it has no imports and reads no DOM.

// `GET` and `PUT` on `/__canvas/requests/<screen id>`, `PUT` on
// `/__canvas/issues/<screen id>`.
export const apiPrefix = '/__canvas/'

export const fileKinds = ['requests', 'issues'] as const

// The folder in the work folder, and the part of the address.
export type FileKind = (typeof fileKinds)[number]

// The largest body of a `PUT`, in bytes.
export const bodyLimit = 1024 * 1024

// The value of the headers `ETag` and `If-Match` for the hash of a text: the
// hash in double quotes.
export function quotedHash(hash: string): string {
  return `"${hash}"`
}

// The hash in the value of an `ETag` or `If-Match` header, in the form that
// `quotedHash` gives. Null with no header and for each other form.
export function hashOfHeader(header: string | null | undefined): string | null {
  const match = /^"([^"]+)"$/.exec(header?.trim() ?? '')
  return match ? match[1] : null
}

// The event of the dev server to the editor when a request file changes, is
// added or is removed, with `{ id }`: the screen id.
export const requestChangedEvent = 'canvas:request-changed'
