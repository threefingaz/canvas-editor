import { useScreenRects } from '../canvas/use-screen-rects.ts'
import type { Rect } from '../canvas/viewport.ts'
import type { Item } from '../edits/model.ts'
import { pinsOf, type Pin } from './pins.ts'

// The pins of one screen (`pinsOf`), from the shared rectangles of its
// targets (`useScreenRects`): the layer of the pins on the canvas, the title
// row of the frame, the Changes tab and the bubble read the same measure,
// thus their numbers agree. The pin of an element is at the first copy of
// its place. A node that the preview hides, and a node with no size, count as
// not found: its comments are in the pin `lost`. With a screen that has no
// comment, the result is empty.
//
// `source` is the current document of the frame, or 'error' for a screen
// file that cannot be read (`pinsSourceOf`): each comment on an element is
// then in the pin `lost`. `place` gives the rectangle of a node of the
// document in the coordinates of the caller. The result is null while the
// pins are not known.

const noPins: Pin[] = []

function isComment(item: Item): boolean {
  return item.edit.change.kind === 'comment'
}

export type PinsSource = Document | 'error' | null

// The source of the pins of a screen: 'error' for a screen file that cannot
// be read, else the current document of its frame.
export function pinsSourceOf(screen: { error?: string }, document: Document | null): PinsSource {
  return screen.error ? 'error' : document
}

export function useScreenPins(
  screenId: string,
  source: PinsSource,
  enabled: boolean,
  place: (nodeRect: Rect) => Rect,
): Pin[] | null {
  return useScreenRects(screenId, { source, enabled, watches: isComment, place, derive: pinsOf, empty: noPins })
}

const inFrame = (nodeRect: Rect) => nodeRect

// The pins of one screen with the rectangles of the frame document, for a
// caller that only reads whether a pin is found (its rectangle is null or
// not), not where it is.
export function useFramePins(screenId: string, source: PinsSource, enabled: boolean): Pin[] | null {
  return useScreenPins(screenId, source, enabled, inFrame)
}
