// The window of a frame document. Editor code that reads a frame takes
// `getComputedStyle`, `ResizeObserver`, `MutationObserver` and `matchMedia`
// from this window, not from the editor window: a node of a frame belongs to
// the frame window.

export type FrameWindow = Window & typeof globalThis

// The window of `document`; null for no document or a document with no window
// (a frame that is gone).
export function frameWindowOf(document: Pick<Document, 'defaultView'> | null | undefined): FrameWindow | null {
  return (document?.defaultView as FrameWindow | null | undefined) ?? null
}

// True when the node is in a frame document that still has its window. A
// node of a frame that reloaded stays connected to its old document, but that
// document has no window, thus no style of the node can be read.
export function inLiveFrame(node: { isConnected: boolean; ownerDocument: Pick<Document, 'defaultView'> | null }): boolean {
  return node.isConnected && frameWindowOf(node.ownerDocument) !== null
}
