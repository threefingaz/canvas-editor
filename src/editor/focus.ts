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
