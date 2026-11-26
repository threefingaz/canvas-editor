import type { Point, Rect, Size, Strips } from '../canvas/viewport.ts'
import { clamp } from '../clamp.ts'
import { arrowsOf, type Arrow, type Flow } from './move.ts'

// The bar of the selection: its place on the canvas and its actions. The bar
// is above the selected element, or below it when there is no room above, and
// it stays in the free part of the canvas: the canvas less the strips at the
// top (the notice) and at the bottom (the toolbar), and `gap` from the left
// and the right edge.

// The top left corner of the bar in canvas coordinates. `selection` is the
// rectangle of the selected element in canvas coordinates. The bar starts at
// the left edge of the selection, `gap` above it; with no room above, `gap`
// below it; with room on neither side (a selection that is as high as the
// free part or higher), inside the selection at its top. The result is kept
// in the free part, thus a selection out of the view gives a bar at the
// nearest edge. A canvas that is smaller than the bar gives the top left
// corner of the free part.
export function barPlace(selection: Rect, bar: Size, canvas: Size, gap: number, strips: Strips): Point {
  const x = clamp(selection.x, gap, canvas.width - gap - bar.width)
  const lowest = canvas.height - strips.bottom - bar.height
  const above = selection.y - gap - bar.height
  const below = selection.y + selection.height + gap
  const y = above >= strips.top ? above : below <= lowest ? below : selection.y
  return { x, y: clamp(y, strips.top, lowest) }
}

export type BarAction = 'comment' | 'options' | 'remove'

// The reason why an element with no place in the code takes no edit.
export const noSite = 'The element has no place in the screen file.'

// True when the selected element is inside an own component of the project:
// its place in the code (`siteFile`) is not in the file of the screen. False
// for an element with no place and for a screen that is not in the list.
export function inOwnComponent(siteFile: string | null, screenFile: string | null): boolean {
  return siteFile !== null && screenFile !== null && siteFile !== screenFile
}

// The actions of the bar, and the reason why they are off, or null when they
// work: each action of the bar is on or off for the same reason, the arrows
// of the move too. `option`: the screen is an option, thus it has no "Ask for
// options" (an option has no options). `block`: the reason why the screen
// takes no edit with a target (an open `keep`, see `editBlock`). `site`: the
// element has a place in the code; with none, it takes no edit. Which arrow
// of the move is on is `arrowNext` of `move.ts`, with `off`.
// `inComponent`: the element is inside an own component of the project: an
// option is a copy of the screen file, and that element is not in it, thus
// it has no "Ask for options" (the component on the screen has it).
export function barActions(state: { option: boolean; block: string | null; site: boolean; inComponent: boolean }): {
  actions: BarAction[]
  off: string | null
} {
  return {
    actions: state.option || state.inComponent ? ['comment', 'remove'] : ['comment', 'options', 'remove'],
    off: state.site ? state.block : noSite,
  }
}

const arrowLabels: Record<Arrow, string> = {
  left: 'Move left (←)',
  right: 'Move right (→)',
  up: 'Move up (↑)',
  down: 'Move down (↓)',
}

// The two arrow buttons of the move, the one at the left (or at the top)
// first, each with its arrow and its label (`arrowsOf`). They name the
// direction on the screen: in a reversed flow the button at the left still
// moves the element to the left, and `stepOf` gives the step in the code.
export type MoveSide = { arrow: Arrow; label: string }

export function moveSides(flow: Flow): [MoveSide, MoveSide] {
  const [first, second] = arrowsOf(flow.axis)
  return [
    { arrow: first, label: arrowLabels[first] },
    { arrow: second, label: arrowLabels[second] },
  ]
}
