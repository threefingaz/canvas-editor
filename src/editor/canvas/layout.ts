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
// no frame at the right of the crop.
export type FrameBox<S extends LayoutScreen = LayoutScreen> = {
  screen: S
  x: number
  y: number
  width: number
  height: number
  crop?: Rect
  titleWidth?: number
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
      for (const item of [screen, ...options]) {
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

// Measures the frame height at the least height and sets it. The iframe first
// gets the least height, then the document gives its scroll height, then the
// iframe gets that height. All three happen in one task, with no paint
// between. A screen that fills its viewport (`100vh`) thus gets the height of
// its content or the least height: it gets smaller when its content gets
// smaller, and it does not grow at each measure. A write that changes nothing
// is left out. Null for a frame with no document.
export function measureHeight(frame: MeasuredFrame): number | null {
  const root = frame.contentDocument?.documentElement
  if (!root) return null
  const least = `${defaultFrameHeight}px`
  if (frame.style.height !== least) frame.style.height = least
  const height = frameHeight(root.scrollHeight)
  const result = `${height}px`
  if (frame.style.height !== result) frame.style.height = result
  return height
}

// The map with only the entries of `keys`; the same map when it has no other
// entry. The editor keeps the heights and the documents of the frames by
// screen id, and a screen file can be removed.
export function keepKeys<V>(map: ReadonlyMap<string, V>, keys: ReadonlySet<string>): ReadonlyMap<string, V> {
  if ([...map.keys()].every((key) => keys.has(key))) return map
  return new Map([...map].filter(([key]) => keys.has(key)))
}
