// The step between the coordinates of the editor and of a frame document.
//
// A frame shows its document at the scale of the canvas, with the top left
// corner of the document at `frameRect` in the editor. A point of the editor
// is a point of the document at `(point - frameRect) / scale`, and a rectangle
// of the document shows at `frameRect + rect * scale`. The coordinates of the
// editor can be those of the window (a pointer event) or of the canvas (the
// selection layer); the two functions do not depend on which.

import { toScreen, type Point, type Rect, type View } from '../canvas/viewport.ts'

// `frameRect` is the place of a frame in the editor: only its top left corner
// is used, thus a point or a rectangle fits.
export function toFramePoint(client: Point, frameRect: Point, scale: number): Point {
  return { x: (client.x - frameRect.x) / scale, y: (client.y - frameRect.y) / scale }
}

export function toEditorRect(nodeRect: Rect, frameRect: Point, scale: number): Rect {
  return {
    x: frameRect.x + nodeRect.x * scale,
    y: frameRect.y + nodeRect.y * scale,
    width: nodeRect.width * scale,
    height: nodeRect.height * scale,
  }
}

// The rectangle of a node of a frame in canvas coordinates: `box` is the top
// left corner of the frame in world coordinates, and `nodeRect` the rectangle
// of the node in the frame document.
export function canvasRectOf(view: View, box: Point, nodeRect: Rect): Rect {
  return toEditorRect(nodeRect, toScreen(view, box), view.scale)
}

// The crop of a frame in canvas coordinates: `box` is the frame box of the
// layout, whose `crop` is in the coordinates of the frame document. Null for
// a frame that shows whole. A mark of the canvas is drawn only in it
// (`inCrop` in `canvas/part.ts`).
export function canvasCropOf(view: View, box: Point & { crop?: Rect }): Rect | null {
  return box.crop ? canvasRectOf(view, box, box.crop) : null
}
