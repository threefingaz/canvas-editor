// The step between the coordinates of the editor and of a frame document.
//
// A frame shows its document at the scale of the canvas, with the top left
// corner of the document at `frameRect` in the editor. A point of the editor
// is a point of the document at `(point - frameRect) / scale`, and a rectangle
// of the document shows at `frameRect + rect * scale`. The coordinates of the
// editor can be those of the window (a pointer event) or of the canvas (the
// selection layer); the two functions do not depend on which.

import type { Point, Rect } from '../canvas/viewport.ts'

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
