import type { Arrow } from './selection/move.ts'

// True when the focus is in a field that takes text: an input, a text area, a
// select, or an element that can be edited. A key of the editor (Delete, the
// keys of undo) then does nothing, thus the field gets the key.
export function typingIn(element: { tagName: string; isContentEditable: boolean } | null): boolean {
  if (!element) return false
  if (element.isContentEditable) return true
  const tag = element.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

// True when a field that takes text has the focus in the editor document.
export function typingInActive(): boolean {
  return typingIn(document.activeElement as HTMLElement | null)
}

// The history action of a key: Ctrl or Cmd with Z is undo, and Shift with
// them is redo. Null for a different key and when Alt is down.
export function historyKey(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}): 'undo' | 'redo' | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  if (event.key.toLowerCase() !== 'z') return null
  return event.shiftKey ? 'redo' : 'undo'
}

// True for the key that sends the text of a field with more than one line:
// Enter with Ctrl or Cmd. Enter alone starts a new line.
export function submitKey(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.altKey
}

// The keys of the view, matched by `event.code`, thus a layout where Shift
// with 1 gives a different `key` (`!`, `%`) works the same: Shift with 1 fits
// all frames, Shift with 2 fits the frame of the selection or the listed
// frame, and Shift with 0 zooms to 100%. Null for a different key and when
// Ctrl, Cmd or Alt is down.
export type ViewKey = 'fit-all' | 'fit-frame' | 'actual'

const shiftedViewKeys: Readonly<Record<string, ViewKey>> = { Digit1: 'fit-all', Digit2: 'fit-frame', Digit0: 'actual' }

export function viewKey(event: {
  code: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}): ViewKey | null {
  if (event.ctrlKey || event.metaKey || event.altKey || !event.shiftKey) return null
  return Object.hasOwn(shiftedViewKeys, event.code) ? shiftedViewKeys[event.code] : null
}

// The keys of the bar of the selection: Delete or Backspace (Shift may be
// down) removes the element, C with no Shift, matched by `event.code`, opens
// its comment, and an arrow key with no Shift moves the element one place
// (`{ move }`, the direction on the screen). Null for a different key and
// when Ctrl, Cmd or Alt is down.
export type BarKey = 'remove' | 'comment' | { move: Arrow }

const arrowKeys: Readonly<Record<string, Arrow>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

export function barKey(event: {
  key: string
  code: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}): BarKey | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null
  if (event.key === 'Delete' || event.key === 'Backspace') return 'remove'
  if (Object.hasOwn(arrowKeys, event.key)) return event.shiftKey ? null : { move: arrowKeys[event.key]! }
  return event.code === 'KeyC' && !event.shiftKey ? 'comment' : null
}

// True when an arrow key may move the selected element: the focus is on the
// canvas (`[data-canvas]`) or on no control (the body), and not in a field
// that takes text or in a floating part of the canvas (the comment bubble,
// the options panel, a pin). A positive rule: the focus in the panel, or in
// a list that a control of the panel opens outside the panel, is not on the
// canvas, thus that control gets its arrows.
export function arrowsFree(state: { typing: boolean; floating: boolean; onCanvas: boolean }): boolean {
  return state.onCanvas && !state.typing && !state.floating
}

// True when the focus is on the canvas for `arrowsFree`: on no element, on
// the body, or inside the root of the canvas (`[data-canvas]`) and not in its
// toolbar (`[data-toolbar]`): a control of the toolbar can use the arrows.
export function focusOnCanvas(element: { tagName: string; closest(selector: string): unknown } | null): boolean {
  if (!element || element.tagName.toLowerCase() === 'body') return true
  return element.closest('[data-canvas]') != null && element.closest('[data-toolbar]') == null
}

// What Escape does, in this order: it cancels a drag of the selected
// element, then closes the floating panel (the comment bubble or the options
// panel; only one of them is open), then turns the Preview switch off, then
// clears the selection. Null when there is nothing to do. A field that uses
// Escape for its own work (it puts back its text) prevents the default, and
// the editor then does not call this.
export type EscapeAction = 'cancel-drag' | 'close-floating' | 'operate-off' | 'clear-selection'

export function escapeAction(state: {
  dragging: boolean
  floating: boolean
  operating: boolean
  selected: boolean
}): EscapeAction | null {
  if (state.dragging) return 'cancel-drag'
  if (state.floating) return 'close-floating'
  if (state.operating) return 'operate-off'
  if (state.selected) return 'clear-selection'
  return null
}
