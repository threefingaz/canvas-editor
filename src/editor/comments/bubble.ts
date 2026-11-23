import { isPlaced, locOf, type Item } from '../edits/model.ts'
import { lostPin, screenPin, type Pin } from './pins.ts'

// The state of the floating panel of the canvas: the comment bubble, with the
// comments of one place and a box for a new comment there, or the options
// panel, which asks the agent for options of an element or of the screen.
// Only one of them is open at a time. The bar, the key C, a pin, the title
// row of a frame and the Changes list open them, thus the state is in a store
// (`bubble-store.ts`) and changes only through `bubbleAfter`.

// The place of a new comment: an element of a screen (`loc`, its place in
// the code) or the whole screen (null).
export type BubbleTarget = { screenId: string; loc: string | null }

// `new`: the comments of the place of `target` and a box for a new one there
// (the Comment button of the bar, the key C, "Comment on the screen").
// `pin`: the comments of a pin, by their ids in the current list; `target`
// is the place of a new comment in the pin, null for the pin of the lost
// comments, which has no box.
// `options`: the options panel for the place of `target` (the button "Ask for
// options" of the bar, of the element, or of the title row, of the screen).
// `key`: the key of the panel when its element moved (`bubblePlace`), thus it
// stays mounted with its text and its focus.
// `detached`: the agent took the element of the place out of the screen file,
// or its new place is not certain (the event `gone`). The panel stays open
// with the draft of the place, but it no longer looks for an element at the
// old place (`liveTarget`): a sibling can be there now, and a new comment or
// options item must not go to it.
export type Bubble =
  | { kind: 'closed' }
  | { kind: 'new'; target: BubbleTarget; key?: string; detached?: true }
  | { kind: 'pin'; screenId: string; ids: readonly string[]; target: BubbleTarget | null; key?: string; detached?: true }
  | { kind: 'options'; target: BubbleTarget; key?: string; detached?: true }

export type BubbleEvent =
  | { type: 'open-new'; target: BubbleTarget }
  | { type: 'open-pin'; screenId: string; ids: readonly string[]; target: BubbleTarget | null }
  | { type: 'open-options'; target: BubbleTarget }
  | { type: 'close' }
  // A new value of the selection; `same`: `sameElement(old, new)`, true for
  // the same element with a new node after a reload of its frame.
  | { type: 'selected'; same: boolean }
  // The comments of the open pin that are still in the list, after a change
  // of the list: an undo, a discard, a new request file.
  | { type: 'comments'; left: number }
  // The agent wrote the screen file, and the selected element at `from` is at
  // `to` now (`refind`): a bubble or options panel of that place follows it,
  // and the store moves the draft of the place.
  | { type: 'moved'; screenId: string; from: string; to: string }
  // The agent wrote the screen file, and the selected element at `loc` is
  // gone, or its new place is not certain (`refind` cleared the selection): a
  // bubble or options panel of that place stays open, detached from it.
  | { type: 'gone'; screenId: string; loc: string }

export const closedBubble: Bubble = { kind: 'closed' }

// The next state. An open event replaces the bubble or the options panel that
// is open. A different element or no element closes each of them; the same
// element after a reload keeps it open. A pin with no comment left closes
// the bubble. A moved element takes the bubble of its place with it, with the
// same key; a gone element leaves it open and detached, with the same key. An
// open event for the panel that is open keeps its key too, but not for a
// detached one: an open event of the user attaches a fresh panel to its place.
// An event that changes nothing gives the same state.
export function bubbleAfter(state: Bubble, event: BubbleEvent): Bubble {
  switch (event.type) {
    case 'open-new':
      return sameKey(state, { kind: 'new', target: event.target })
    case 'open-pin':
      return sameKey(state, { kind: 'pin', screenId: event.screenId, ids: [...event.ids], target: event.target })
    case 'open-options':
      return sameKey(state, { kind: 'options', target: event.target })
    // Also when the screen of the bubble is no longer in the list.
    case 'close':
      return state.kind === 'closed' ? state : closedBubble
    case 'selected':
      return event.same || state.kind === 'closed' ? state : closedBubble
    case 'comments':
      return state.kind === 'pin' && event.left === 0 ? closedBubble : state
    case 'moved':
      if (state.kind === 'closed' || state.detached) return state
      if (!bubbleAt(state, { screenId: event.screenId, loc: event.from })) return state
      return { ...state, target: { screenId: event.screenId, loc: event.to }, key: bubblePlace(state) }
    case 'gone':
      if (state.kind === 'closed' || state.detached) return state
      if (!bubbleAt(state, { screenId: event.screenId, loc: event.loc })) return state
      return { ...state, key: bubblePlace(state), detached: true }
  }
}

// `next`, with the key of `state` when the two are the same panel (the same
// kind, screen and place) and `state` kept its key after a move.
function sameKey(state: Bubble, next: OpenBubble): OpenBubble {
  if (state.kind === 'closed' || state.detached || state.key === undefined || placeOf(state) !== placeOf(next)) return next
  return { ...next, key: state.key }
}

// True when the bubble or the options panel is open for the place `place`.
export function bubbleAt(state: Bubble, place: BubbleTarget): boolean {
  if (state.kind === 'closed' || state.target === null) return false
  return state.target.screenId === place.screenId && state.target.loc === place.loc
}

// The text of the draft of a place after the draft `moved` of a different
// place came to it: the two texts, thus none is lost.
export function joinDrafts(here: string, moved: string): string {
  if (here === '') return moved
  if (moved === '') return here
  return `${here}\n\n${moved}`
}

// The place whose element an open panel looks for in the frame: its target;
// null for a detached panel, thus it finds no element (`targetSite`), and its
// new box is the kept draft or the note that the element is not found
// (`newBoxOf`).
export function liveTarget(state: OpenBubble): BubbleTarget | null {
  return state.detached ? null : state.target
}

// The screen of an open bubble or options panel; null when it is closed.
export function bubbleScreen(state: Bubble): string | null {
  if (state.kind === 'closed') return null
  return state.kind === 'pin' ? state.screenId : state.target.screenId
}

// The key of the draft of a new comment on a place. Each screen id and each
// place give one key.
export function draftKey(target: BubbleTarget): string {
  return JSON.stringify([target.screenId, target.loc])
}

// The screen id of a key of `draftKey`.
export function draftScreen(key: string): string {
  return (JSON.parse(key) as [string, unknown])[0]
}

// An open bubble or options panel.
export type OpenBubble = Exclude<Bubble, { kind: 'closed' }>

// The comment bubble, with no options panel.
export type CommentsBubble = Exclude<Bubble, { kind: 'closed' } | { kind: 'options' }>

// The key of an open panel: its kind, its screen and its place (the element,
// the screen, or the lost comments). A new key mounts the panel again; a pin
// that gets one more comment keeps its key, thus its open parts stay. A panel
// whose element the agent moved keeps the key of its first place (`key`),
// thus its text, its open parts and its focus stay.
export function bubblePlace(state: OpenBubble): string {
  return state.key ?? placeOf(state)
}

// The kind, the screen and the current place of an open panel.
function placeOf(state: OpenBubble): string {
  const place = state.target === null ? lostPin : (state.target.loc ?? screenPin)
  return JSON.stringify([state.kind, bubbleScreen(state), place])
}

// The event that opens the bubble with the comments of a pin. A new comment in
// it goes to the element of the pin, or to the screen for the pin of the
// screen; the pin of the lost comments takes no new comment.
export function pinEvent(screenId: string, pin: Pick<Pin, 'key' | 'ids'>): BubbleEvent {
  const target = pin.key === lostPin ? null : { screenId, loc: pin.key === screenPin ? null : pin.key }
  return { type: 'open-pin', screenId, ids: pin.ids, target }
}

// The event after a new comment with `id` went to the store from the bubble:
// the bubble of a pin opens again with that comment in it; null for the
// bubble of a new comment, which lists the comments of its place anyway.
export function afterAdd(state: CommentsBubble, id: string): BubbleEvent | null {
  if (state.kind !== 'pin') return null
  return { type: 'open-pin', screenId: state.screenId, ids: [...state.ids, id], target: state.target }
}

// The comments that the bubble lists, in the order of the list: those of the
// pin that are still in the list, by id; for a new comment on the screen, the
// comments on the screen; for a new comment on an element, the comments of
// that place that are not stale, as the pin of the element has them (a stale
// one is in the pin of the lost comments); none for a detached bubble of an
// element, whose old place can hold a different element now.
export function commentsOf(state: CommentsBubble, items: readonly Item[]): Item[] {
  const comments = items.filter((item) => item.edit.change.kind === 'comment')
  if (state.kind === 'pin') return comments.filter((item) => state.ids.includes(item.edit.id))
  const { loc } = state.target
  if (loc === null) return comments.filter((item) => !isPlaced(item.edit))
  if (state.detached) return []
  return comments.filter((item) => !item.stale && isPlaced(item.edit) && locOf(item.edit.target) === loc)
}

// The name of the place of the bubble in its header: the element of the
// lost comments is not found; the screen; else the tag of the element (from
// its site in the frame, or from the target of its first comment).
export function bubbleName(state: CommentsBubble, tag: string | null, comments: readonly Item[]): string {
  if (state.target === null) return 'Not found in the code'
  if (state.target.loc === null) return 'Screen'
  return tag ?? comments[0]?.edit.target?.tag ?? 'Element'
}

// The part of the bubble for a new comment: the box; the reason why the
// element takes no new comment (`block`, an open `keep`), or the note that
// the element is not found in the frame (`site` false); null for the pin of
// the lost comments. The screen always takes a comment. An element that is
// not found while its place has a draft (`draft`; the agent took it out of
// the screen file while the user typed) gives `draft`: the box with the text,
// a warning, and a button that adds it as a comment on the screen.
export type NewBox = 'box' | 'blocked' | 'no-site' | 'draft' | null

export function newBoxOf(target: BubbleTarget | null, block: string | null, site: boolean, draft = false): NewBox {
  if (target === null) return null
  if (target.loc === null) return 'box'
  if (!site && draft) return 'draft'
  if (block !== null) return 'blocked'
  return site ? 'box' : 'no-site'
}
