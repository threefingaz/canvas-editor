// The local file API of the dev server (`tools/requests-plugin.ts`): the
// addresses, the limit of a body, and the event that tells the editor about a
// request file that changed. The editor and the plugin both import this
// module, thus it has no imports and reads no DOM.

// `GET` and `PUT` on `/__canvas/requests/<screen id>`, `PUT` on
// `/__canvas/issues/<screen id>`, and the screen actions below. A `PUT` of a
// request needs `If-Match` with the hash of its base: 428 with none, 409 with
// the current file when the base is not the file on the disk.
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

// `GET` on this address gives the way of "Send to the agent" (an
// `AgentWayAnswer`). `POST` starts the command that opens the chat of the
// agent with the fixed sentence (`tools/agent-plugin.ts`). The call carries
// no content: the command and the sentence are fixed on the server.
export const agentAddress = `${apiPrefix}agent`

// The way of "Send to the agent": the clipboard (the one button "Copy for the
// agent"), or a command of the dev server, with the name of its preset, or
// null for a command of the user.
export type AgentWayAnswer = { way: 'clipboard' } | { way: 'command'; preset: string | null }

// The answer of `agentAddress`, with the status 200 in the two cases.
// `reason` is a short text for the user: why the command did not start.
export type AgentAnswer = { started: true } | { started: false; reason: string }

// `POST` on this address does one screen action (`tools/screen-ops.ts`) with a
// `ScreenAction` as JSON. The answer is 200 with an `ActionAnswer` when the
// action ran, 409 with an `ActionAnswer` when the plan refused it (nothing
// changed), 404 for a screen that is not in the list, 400 for a body that is
// not an action, 403 for a call from a different origin, 415 for a content
// type that is not JSON, 413 for a larger body, and 500 with a text when a
// step failed (the text says whether the files are as before).
export const screensAddress = `${apiPrefix}screens`

// `GET` on this address gives the deleted screens in the trash, as a
// `TrashAnswer`.
export const trashAddress = `${apiPrefix}trash`

// One screen action. `screen` is the id of a screen of the list; a restore
// names the folder of the trash (`TrashItem.folder`) in place of a screen.
// `to` of a move in the row is the position from 0 among the base screens of
// the row; `flow` of a rename is '' for the screens folder itself.
export type ScreenAction =
  | { action: 'reorder'; screen: string; to: number }
  | { action: 'title'; screen: string; title: string }
  | { action: 'rename'; screen: string; flow: string; name: string }
  | { action: 'delete'; screen: string }
  | { action: 'restore'; folder: string }

// A change of the id of a screen: `from` null for a restored screen, `to` null
// for a deleted one.
export type IdChange = { from: string | null; to: string | null }

// The plan that the server applied, with no file content. `screens` are the
// screens whose id changed, the screen of the action first; `linkedBy` are
// the screens that link to a deleted screen. Each path is relative to the
// project root.
export type AppliedAction = {
  action: ScreenAction['action']
  screen: string
  screens: IdChange[]
  linkedBy: string[]
  moves: { from: string; to: string }[]
  writes: string[]
  removes: string[]
}

export type ActionAnswer = { applied: true; plan: AppliedAction } | { applied: false; refusals: string[] }

// A deleted screen in the trash: the folder in `.canvas/trash/` and its
// manifest.
export type TrashItem = { folder: string; screen: string; files: string[]; time: string }

export type TrashAnswer = { items: TrashItem[] }
