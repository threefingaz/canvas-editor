// The place of each frame on the canvas, in world coordinates. One flow is one
// row. A row is a sequence of groups (`screenGroups`): a base screen and its
// states, left to right. The options of a frame are a column below it. The
// groups, the states and the options keep the order of the list. The user
// does not move frames.
//
// An option with a part (`part.ts`) shows cropped to its block. Its box is
// still the box of its iframe, thus the corner of the box is the corner of
// the frame document for each rectangle that the canvas reads from it; the
// box has the crop, and the layout places the frame by the size of the crop:
// the corner of the box is shifted so that the crop is where the box of a
// whole frame would be (`shownRect`).

import type { ScreenEntry } from 'virtual:canvas-screens'
import { screenGroups, type Related } from '../../related/groups.ts'
import { cropOf } from './part.ts'
import type { Rect } from './viewport.ts'

export type LayoutScreen = Pick<ScreenEntry, 'id' | 'flow' | 'width' | 'error' | 'stateOf' | 'optionOf'>

// The box of a frame keeps the entry of its screen. The box is the box of
// the iframe, in world coordinates. `crop` is the part of the frame that
// shows, in the coordinates of the frame document (from the corner of the
// box); a whole frame has none. `titleWidth` is the room of the title row of
// a frame with a crop, in world coordinates: the width of its column, because
// the crop of a small block is narrower than its title, and the column has
// no frame at the right of the crop. `optionNumber` is the number of an
// option among the options of its frame, from 1, in the order of the list
// (`screenGroups`); a screen that is not an option of a frame has none.
export type FrameBox<S extends LayoutScreen = LayoutScreen> = {
  screen: S
  x: number
  y: number
  width: number
  height: number
  crop?: Rect
  titleWidth?: number
  optionNumber?: number
}

// The rectangle of a frame that shows on the canvas, in world coordinates:
// its crop, or the whole box. The title row, the edge, a fit of the view and
// the place of the next frame read this rectangle; a rectangle of the frame
// document is placed from the corner of the box itself.
export function shownRect(box: Pick<FrameBox, 'x' | 'y' | 'width' | 'height' | 'crop'>): Rect {
  const { crop } = box
  if (!crop) return { x: box.x, y: box.y, width: box.width, height: box.height }
  return { x: box.x + crop.x, y: box.y + crop.y, width: crop.width, height: crop.height }
}

export type FrameLayout<S extends LayoutScreen = LayoutScreen> = { frames: FrameBox<S>[]; bounds: Rect }

// The space between two frames of a group: a base and its states.
export const frameGap = 80
// The space between two groups of a row, wider than `frameGap`, thus a group
// reads as one thing.
export const groupGap = 240
// The space between two rows; the titles of the lower row are in it.
export const rowGap = 360
// The space between a frame and its first option, and between two options of
// a column. A title keeps its size on the screen, thus it needs as much space
// of the canvas as the title of a row.
export const optionGap = rowGap
// The height of the viewport of a frame: the height before the frame document
// tells its height, and the least height of a frame. A screen that fills the
// viewport (`100vh`) thus has one height, and the height does not depend on
// the moment when the editor measures it.
export const defaultFrameHeight = 900
// The height of a frame that shows an error of the screen file.
export const errorFrameHeight = 320

// The most height of a frame: a document that is higher stops here.
export const maxFrameHeight = 20000

const noParts: ReadonlyMap<string, Rect> = new Map()

// `heights` has the measured heights by screen id. `parts` has the rectangle
// of the part of each screen that shows cropped (`croppedParts`), by screen
// id, in the coordinates of its frame document; a screen with no entry shows
// whole.
export function layoutFrames<S extends LayoutScreen>(
  screens: readonly S[],
  heights: ReadonlyMap<string, number>,
  parts: ReadonlyMap<string, Rect> = noParts,
): FrameLayout<S> {
  // The rows in the order of the first screen of each flow.
  const rows = new Map<string, S[]>()
  for (const screen of screens) {
    const row = rows.get(screen.flow)
    if (row) row.push(screen)
    else rows.set(screen.flow, [screen])
  }

  const heightOf = (screen: S) => heights.get(screen.id) ?? (screen.error ? errorFrameHeight : defaultFrameHeight)

  const frames: FrameBox<S>[] = []
  let y = 0
  let width = 0
  let height = 0
  for (const row of rows.values()) {
    let x = 0
    let rowHeight = 0
    // A column: a frame and its options below it, as wide as its widest
    // frame. It gives the width of the column. A frame with a crop takes the
    // room of its crop, and its box starts before that room.
    const column = ({ screen, options }: Related<S>): number => {
      let columnY = y
      let columnWidth = 0
      const first = frames.length
      // The base of the column is at 0, thus the index of an option is its
      // number.
      for (const [number, item] of [screen, ...options].entries()) {
        const frameHeight = heightOf(item)
        const part = item.error ? undefined : parts.get(item.id)
        const crop = part && cropOf(part, { width: item.width, height: frameHeight })
        const shown = crop ?? { x: 0, y: 0, width: item.width, height: frameHeight }
        frames.push({
          screen: item,
          x: x - shown.x,
          y: columnY - shown.y,
          width: item.width,
          height: frameHeight,
          ...(crop ? { crop } : {}),
          ...(number > 0 ? { optionNumber: number } : {}),
        })
        columnWidth = Math.max(columnWidth, shown.width)
        rowHeight = Math.max(rowHeight, columnY + shown.height - y)
        columnY += shown.height + optionGap
      }
      for (const frame of frames.slice(first)) if (frame.crop) frame.titleWidth = columnWidth
      width = Math.max(width, x + columnWidth)
      return columnWidth
    }
    screenGroups(row).forEach((group, index) => {
      if (index > 0) x += groupGap
      x += column(group.base)
      for (const state of group.states) {
        x += frameGap
        x += column(state)
      }
    })
    height = y + rowHeight
    y = height + rowGap
  }

  return { frames, bounds: { x: 0, y: 0, width, height } }
}

// The frame height for the measured height of a frame document: the content
// height, but not less than the viewport height.
export function frameHeight(measured: number): number {
  return Math.min(maxFrameHeight, Math.max(defaultFrameHeight, Math.ceil(measured)))
}

// The parts of an iframe that the measure uses; a plain object in the tests.
export type MeasuredFrame = {
  style: { height: string }
  contentDocument: { documentElement: { scrollHeight: number } } | null
}

// A part of the frame document that can hide content: a live element, read
// two times by the measure.
export type Scroller = { readonly clientHeight: number; readonly scrollHeight: number }

// How far the measure makes the frame taller to see which parts follow the
// height of the viewport, in px.
export const probeHeight = 200

// The least share of the extra height that a part gets to count as a part
// that follows the viewport: a pane of two has a half. A part with a small
// share (a list with `max-height: 40vh`) is a part of the screen with a
// height of its own, and the frame does not grow for it.
export const leastShare = 0.5

// How many times the measure looks again at a part whose content got taller
// with the frame.
const growRounds = 4

// Measures the frame height at the least height and sets it. The iframe first
// gets the least height, then the document gives its scroll height, then the
// iframe gets that height. All happens in one task, with no paint between. A
// screen that fills its viewport (`100vh`) thus gets the height of its
// content or the least height: it gets smaller when its content gets smaller,
// and it does not grow at each measure. A write that changes nothing is left
// out. Null for a frame with no document.
//
// A screen can keep its content in a part that scrolls inside a root as tall
// as the viewport (the shell of an application): the document then has no
// scroll height of its own, and the frame would cut the content. Only then
// (the document is not taller than the least height and `probeHeight`: a
// long page that scrolls by itself is not read) the measure asks
// `scrollers` for the parts that hide content (`hidingParts`), and
// `probedHeight` gives the height that shows all of their content.
export function measureHeight(frame: MeasuredFrame, scrollers?: () => readonly Scroller[]): number | null {
  const root = frame.contentDocument?.documentElement
  if (!root) return null
  const least = `${defaultFrameHeight}px`
  if (frame.style.height !== least) frame.style.height = least
  // The height of the document at the least height: more than the least
  // height by the margins around a root as tall as the viewport.
  const base = Math.max(defaultFrameHeight, root.scrollHeight)
  const parts = scrollers && base <= defaultFrameHeight + probeHeight ? scrollers() : []
  const height = frameHeight(parts.length > 0 ? probedHeight(frame, parts, base) : base)
  const result = `${height}px`
  if (frame.style.height !== result) frame.style.height = result
  return height
}

// The height of the content that a part hides now, in px.
const hiddenOf = (part: Scroller) => part.scrollHeight - part.clientHeight

// The height of a frame that shows all of the content of the parts that
// follow the viewport; `base` when no part does. `parts` are read at the
// least height, which the frame has at the call. The frame gets taller by
// `probeHeight` one time. A part that got taller with it, and hides less
// then, follows the viewport, with the share of the extra height that it
// got (two panes, one above the other, get a half each; a smaller share
// than `leastShare` does not count), and the frame needs its hidden height
// divided by that share. A part with a height of its own (a list of 200 px
// that scrolls) does not get taller, and a part whose content grows with it
// hides the same at each height: these stay as they are. The function
// leaves the frame at a height of a trial; the caller sets the result.
function probedHeight(frame: MeasuredFrame, parts: readonly Scroller[], base: number): number {
  const read = parts
    .map((part) => ({ part, client: part.clientHeight, hidden: hiddenOf(part) }))
    .filter((item) => item.hidden > 0)
  if (read.length === 0) return base
  let measured = base
  const followers: { part: Scroller; share: number }[] = []
  const follow = (item: (typeof read)[number], share: number) => {
    const follower = { part: item.part, share: Math.min(1, share) }
    followers.push(follower)
    measured = Math.max(measured, base + item.hidden / follower.share)
  }

  frame.style.height = `${defaultFrameHeight + probeHeight}px`
  // The parts that show all of their content at the probe stopped at their
  // content: the share that they got is not known yet.
  const stopped: typeof read = []
  for (const item of read) {
    const share = (item.part.clientHeight - item.client) / probeHeight
    const hiddenThen = hiddenOf(item.part)
    if (share <= 0) continue
    if (hiddenThen <= 0) stopped.push(item)
    else if (share >= leastShare && hiddenThen < item.hidden) follow(item, share)
  }
  if (stopped.length > 0) {
    // A trial at the height for a full share. A part that shows all of its
    // content there needs no more; a part that does not has not stopped, and
    // the height that it got gives its share.
    const trial = Math.max(measured, base + Math.max(...stopped.map((item) => item.hidden)))
    frame.style.height = `${trial}px`
    let shown = false
    for (const item of stopped) {
      if (hiddenOf(item.part) <= 0) {
        shown = true
        continue
      }
      const share = (item.part.clientHeight - item.client) / (trial - defaultFrameHeight)
      if (share >= leastShare) follow(item, share)
    }
    if (shown) measured = Math.max(measured, trial)
  }
  // The content of a part can get taller with the frame (a child with a
  // height in `vh`): look again at the new height, a few times at most.
  for (let round = 0; round < growRounds && followers.length > 0 && measured < maxFrameHeight; round += 1) {
    frame.style.height = `${frameHeight(measured)}px`
    const rest = Math.max(...followers.map((follower) => hiddenOf(follower.part) / follower.share))
    if (rest < 1) break
    measured += rest
  }
  return measured
}

// The selector of the elements that the measure reads for `hidingParts`.
// `rootOverflowY` is the computed `overflow-y` of the root element. With
// `visible` there, the overflow of the body goes to the viewport: the
// document scrolls, its scroll height already has the content, and the body
// is not a part. With a different value the body can be the part that
// scrolls.
export function partsSelector(rootOverflowY: string): string {
  return rootOverflowY === 'visible' ? 'body *' : 'body, body *'
}

// The elements of a frame document that hide content below their edge now
// and that a person can scroll: their content is taller than they are, and
// their `overflow-y` is `auto`, `scroll` or `overlay`. A part that clips
// (`hidden`, `clip`) hides its content on purpose (a sheet below the edge),
// and stays as it is. `styleOf` is the `getComputedStyle` of the frame
// window.
export function hidingParts<E extends Scroller>(elements: Iterable<E>, styleOf: (element: E) => { overflowY: string }): E[] {
  const parts: E[] = []
  for (const element of elements) {
    if (element.scrollHeight - element.clientHeight < 1 || element.clientHeight === 0) continue
    if (scrollValues.has(styleOf(element).overflowY)) parts.push(element)
  }
  return parts
}

const scrollValues = new Set(['auto', 'scroll', 'overlay'])

// The map with only the entries of `keys`; the same map when it has no other
// entry. The editor keeps the heights and the documents of the frames by
// screen id, and a screen file can be removed.
export function keepKeys<V>(map: ReadonlyMap<string, V>, keys: ReadonlySet<string>): ReadonlyMap<string, V> {
  if ([...map.keys()].every((key) => keys.has(key))) return map
  return new Map([...map].filter(([key]) => keys.has(key)))
}
