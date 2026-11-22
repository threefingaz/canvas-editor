import { describe, expect, test } from 'vitest'
import {
  canScroll,
  centerOn,
  centerRect,
  clampScale,
  inView,
  noStrips,
  maxScale,
  minScale,
  pan,
  resized,
  revealView,
  titleRowRect,
  toScreen,
  toWorld,
  wheelDelta,
  wheelZoomFactor,
  zoomAnchor,
  zoomAt,
  zoomStep,
  type View,
} from './viewport.ts'

const start: View = { x: 100, y: 50, scale: 1 }

describe('pan', () => {
  test('moves the world by the delta', () => {
    expect(pan(start, 10, -20)).toEqual({ x: 110, y: 30, scale: 1 })
  })

  test('keeps the scale', () => {
    expect(pan({ x: 0, y: 0, scale: 2 }, 5, 5).scale).toBe(2)
  })
})

describe('toWorld and toScreen', () => {
  test('are the inverse of each other', () => {
    const view: View = { x: 30, y: -40, scale: 2.5 }
    const point = { x: 200, y: 120 }
    const world = toWorld(view, point)
    expect(toScreen(view, world).x).toBeCloseTo(point.x)
    expect(toScreen(view, world).y).toBeCloseTo(point.y)
  })
})

describe('clampScale', () => {
  test('keeps a scale in the range', () => {
    expect(clampScale(1.5)).toBe(1.5)
  })

  test('limits a scale to the minimum and the maximum', () => {
    expect(clampScale(0)).toBe(minScale)
    expect(clampScale(1000)).toBe(maxScale)
  })
})

describe('zoomAt', () => {
  test('keeps the point below the pointer in its place', () => {
    const point = { x: 400, y: 300 }
    const before = toWorld(start, point)
    const next = zoomAt(start, 2, point)
    expect(next.scale).toBe(2)
    const after = toWorld(next, point)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  test('zooms out at the pointer', () => {
    const point = { x: 10, y: 700 }
    const before = toWorld(start, point)
    const after = toWorld(zoomAt(start, 0.5, point), point)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  test('stops at the maximum and keeps the point in its place', () => {
    const point = { x: 250, y: 250 }
    const before = toWorld(start, point)
    const next = zoomAt(start, 1000, point)
    expect(next.scale).toBe(maxScale)
    const after = toWorld(next, point)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  test('stops at the minimum', () => {
    expect(zoomAt(start, 0.0001, { x: 0, y: 0 }).scale).toBe(minScale)
  })

  test('gives the same view when the scale cannot change', () => {
    const atMax: View = { x: 0, y: 0, scale: maxScale }
    expect(zoomAt(atMax, 2, { x: 50, y: 50 })).toBe(atMax)
  })
})

describe('zoomStep', () => {
  const center = { x: 500, y: 400 }

  test('goes to the next step in', () => {
    expect(zoomStep(start, 1, center).scale).toBe(1.5)
  })

  test('goes to the next step out', () => {
    expect(zoomStep(start, -1, center).scale).toBe(0.75)
  })

  test('goes from a value between two steps to the nearest step in that direction', () => {
    const view: View = { x: 0, y: 0, scale: 0.6 }
    expect(zoomStep(view, 1, center).scale).toBe(0.75)
    expect(zoomStep(view, -1, center).scale).toBe(0.5)
  })

  test('keeps the center point in its place', () => {
    const before = toWorld(start, center)
    const after = toWorld(zoomStep(start, 1, center), center)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  test('does not go past the last step', () => {
    const atMax: View = { x: 0, y: 0, scale: maxScale }
    expect(zoomStep(atMax, 1, center)).toBe(atMax)
    const atMin: View = { x: 0, y: 0, scale: minScale }
    expect(zoomStep(atMin, -1, center)).toBe(atMin)
  })
})

describe('centerOn', () => {
  const size = { width: 1200, height: 800 }

  test('puts small content in the middle at 100%', () => {
    const view = centerOn({ x: 0, y: 0, width: 400, height: 200 }, size, noStrips)
    expect(view.scale).toBe(1)
    expect(toScreen(view, { x: 200, y: 100 })).toEqual({ x: 600, y: 400 })
  })

  test('makes large content fit with a margin', () => {
    const bounds = { x: 0, y: 0, width: 4000, height: 1000 }
    const view = centerOn(bounds, size, noStrips, 50)
    expect(view.scale).toBeCloseTo(1100 / 4000)
    const topLeft = toScreen(view, { x: 0, y: 0 })
    const bottomRight = toScreen(view, { x: 4000, y: 1000 })
    expect(topLeft.x).toBeCloseTo(50)
    expect(bottomRight.x).toBeCloseTo(1150)
    expect((topLeft.y + bottomRight.y) / 2).toBeCloseTo(400)
  })

  test('uses the height when the height limits', () => {
    const view = centerOn({ x: 100, y: 100, width: 500, height: 3000 }, size, noStrips, 0)
    expect(view.scale).toBeCloseTo(800 / 3000)
    const middle = toScreen(view, { x: 350, y: 1600 })
    expect(middle.x).toBeCloseTo(600)
    expect(middle.y).toBeCloseTo(400)
  })

  test('respects the minimum scale for very large content', () => {
    const view = centerOn({ x: 0, y: 0, width: 1e7, height: 1e7 }, size, noStrips)
    expect(view.scale).toBe(minScale)
  })

  test('gives scale 1 with the point in the middle for empty bounds', () => {
    const view = centerOn({ x: 10, y: 20, width: 0, height: 0 }, size, noStrips)
    expect(view.scale).toBe(1)
    expect(toScreen(view, { x: 10, y: 20 })).toEqual({ x: 600, y: 400 })
  })

  test('gives scale 1 when the canvas has no size yet', () => {
    const view = centerOn({ x: 0, y: 0, width: 400, height: 200 }, { width: 0, height: 0 }, noStrips)
    expect(view.scale).toBe(1)
  })

  test('puts small content in the middle of the part between the strips', () => {
    const view = centerOn({ x: 0, y: 0, width: 400, height: 200 }, size, { top: 40, bottom: 120 })
    expect(view.scale).toBe(1)
    // The free part is from 40 to 680: its middle is at 360.
    expect(toScreen(view, { x: 200, y: 100 })).toEqual({ x: 600, y: 360 })
  })

  test('makes tall content fit between the strips and the padding', () => {
    const view = centerOn({ x: 0, y: 0, width: 500, height: 3000 }, size, { top: 24, bottom: 64 }, 10)
    expect(view.scale).toBeCloseTo((800 - 24 - 64 - 20) / 3000)
    const top = toScreen(view, { x: 0, y: 0 })
    const bottom = toScreen(view, { x: 0, y: 3000 })
    expect(top.y).toBeCloseTo(24 + 10)
    expect(bottom.y).toBeCloseTo(800 - 64 - 10)
  })

  test('strips that take the whole height give scale 1 in the middle of the canvas', () => {
    const view = centerOn({ x: 0, y: 0, width: 400, height: 200 }, size, { top: 500, bottom: 500 })
    expect(view.scale).toBe(1)
    expect(toScreen(view, { x: 200, y: 100 })).toEqual({ x: 600, y: 400 })
  })
})

describe('inView', () => {
  const size = { width: 1000, height: 600 }

  test('true when the middle of the rectangle is in the canvas', () => {
    expect(inView({ x: 100, y: 100, width: 50, height: 20 }, size, 0, noStrips)).toBe(true)
  })

  test('false when the middle is out of the canvas at any side', () => {
    expect(inView({ x: -100, y: 100, width: 50, height: 20 }, size, 0, noStrips)).toBe(false)
    expect(inView({ x: 1000, y: 100, width: 50, height: 20 }, size, 0, noStrips)).toBe(false)
    expect(inView({ x: 100, y: -50, width: 50, height: 20 }, size, 0, noStrips)).toBe(false)
    expect(inView({ x: 100, y: 700, width: 50, height: 20 }, size, 0, noStrips)).toBe(false)
  })

  test('a rectangle larger than the canvas is in the view when its middle shows', () => {
    expect(inView({ x: -2000, y: -2000, width: 5000, height: 4600 }, size, 0, noStrips)).toBe(true)
  })

  test('the margin makes the part that counts smaller', () => {
    const nearEdge = { x: 0, y: 290, width: 20, height: 20 }
    expect(inView(nearEdge, size, 0, noStrips)).toBe(true)
    expect(inView(nearEdge, size, 16, noStrips)).toBe(false)
  })

  test('a middle under the toolbar or the notice is not in the view', () => {
    const strips = { top: 48, bottom: 64 }
    const underToolbar = { x: 400, y: 550, width: 40, height: 20 }
    expect(inView(underToolbar, size, 0, noStrips)).toBe(true)
    expect(inView(underToolbar, size, 0, strips)).toBe(false)
    const underNotice = { x: 400, y: 20, width: 40, height: 20 }
    expect(inView(underNotice, size, 0, strips)).toBe(false)
    // The margin counts from the edge of the free part.
    const aboveToolbar = { x: 400, y: 500, width: 40, height: 20 }
    expect(inView(aboveToolbar, size, 0, strips)).toBe(true)
    expect(inView(aboveToolbar, size, 48, strips)).toBe(false)
  })
})

describe('zoomAnchor', () => {
  const size = { width: 1000, height: 600 }

  test('the middle of a selection in the view', () => {
    expect(zoomAnchor(size, { x: 100, y: 200, width: 60, height: 40 })).toEqual({ x: 130, y: 220 })
  })

  test('the middle of the canvas for a selection out of the view', () => {
    expect(zoomAnchor(size, { x: 1200, y: 200, width: 60, height: 40 })).toEqual({ x: 500, y: 300 })
  })

  test('the middle of the canvas with no selection', () => {
    expect(zoomAnchor(size, null)).toEqual({ x: 500, y: 300 })
  })

  test('a zoom at the anchor keeps a selection in the view', () => {
    const view: View = { x: 0, y: 0, scale: 0.25 }
    const selection = { x: 800, y: 500, width: 40, height: 20 }
    const next = zoomAt(view, 4, zoomAnchor(size, selection))
    const world = toWorld(view, { x: 820, y: 510 })
    expect(toScreen(next, world).x).toBeCloseTo(820)
    expect(toScreen(next, world).y).toBeCloseTo(510)
  })
})

describe('centerRect', () => {
  const size = { width: 1000, height: 600 }

  test('moves the middle of the rectangle to the middle of the canvas and keeps the scale', () => {
    const view: View = { x: 10, y: 20, scale: 0.5 }
    const next = centerRect(view, { x: 1500, y: -100, width: 100, height: 40 }, size, noStrips)
    expect(next).toEqual({ x: 10 + 500 - 1550, y: 20 + 300 + 80, scale: 0.5 })
  })

  test('a rectangle in the middle keeps the view', () => {
    const view: View = { x: 10, y: 20, scale: 2 }
    expect(centerRect(view, { x: 450, y: 250, width: 100, height: 100 }, size, noStrips)).toEqual(view)
  })

  test('with strips, the middle of the free part', () => {
    const view: View = { x: 0, y: 0, scale: 1 }
    // The free part goes from 48 to 536: its middle is at 292.
    const next = centerRect(view, { x: 480, y: 550, width: 40, height: 20 }, size, { top: 48, bottom: 64 })
    expect(next).toEqual({ x: 0, y: 292 - 560, scale: 1 })
  })

  test('strips with no free height give the middle of the canvas', () => {
    const view: View = { x: 0, y: 0, scale: 1 }
    expect(centerRect(view, { x: 480, y: 290, width: 40, height: 20 }, size, { top: 400, bottom: 400 })).toEqual(view)
  })
})

describe('wheelDelta', () => {
  test('keeps pixel deltas', () => {
    expect(wheelDelta(12, 0, 700)).toBe(12)
  })

  test('converts lines and pages to pixels', () => {
    expect(wheelDelta(3, 1, 700)).toBe(48)
    expect(wheelDelta(1, 2, 700)).toBe(700)
  })
})

describe('wheelZoomFactor', () => {
  test('zooms in for a negative delta and out for a positive delta', () => {
    expect(wheelZoomFactor(-10)).toBeGreaterThan(1)
    expect(wheelZoomFactor(10)).toBeLessThan(1)
    expect(wheelZoomFactor(0)).toBe(1)
  })

  test('is symmetric', () => {
    expect(wheelZoomFactor(20) * wheelZoomFactor(-20)).toBeCloseTo(1)
  })

  test('limits the change of one large wheel step', () => {
    expect(wheelZoomFactor(-1000)).toBe(wheelZoomFactor(-50))
    expect(wheelZoomFactor(1000)).toBe(wheelZoomFactor(50))
  })
})

describe('resized', () => {
  const view: View = { x: 40, y: -30, scale: 0.5 }
  const before = { width: 800, height: 600 }
  const middle = (size: { width: number; height: number }) => ({ x: size.width / 2, y: size.height / 2 })

  test('a wider canvas keeps the world point in the middle', () => {
    const after = { width: 1000, height: 600 }
    const next = resized(view, before, after)
    expect(next).toEqual({ x: 140, y: -30, scale: 0.5 })
    expect(toWorld(next, middle(after))).toEqual(toWorld(view, middle(before)))
  })

  test('a narrower and taller canvas keeps the world point in the middle', () => {
    const after = { width: 500, height: 700 }
    const next = resized(view, before, after)
    expect(next).toEqual({ x: -110, y: 20, scale: 0.5 })
    expect(toWorld(next, middle(after))).toEqual(toWorld(view, middle(before)))
  })

  test('the same size keeps the view', () => {
    expect(resized(view, before, { ...before })).toBe(view)
  })
})

describe('canScroll', () => {
  // A list of 300 px in a box of 100 px.
  const box = { scrollTop: 0, scrollLeft: 0, scrollHeight: 300, scrollWidth: 200, clientHeight: 100, clientWidth: 200 }

  test('at the top: down scrolls the box, up goes to the canvas', () => {
    expect(canScroll(box, 0, 10)).toBe(true)
    expect(canScroll(box, 0, -10)).toBe(false)
  })

  test('in the middle: each direction of the list scrolls the box', () => {
    const middle = { ...box, scrollTop: 100 }
    expect(canScroll(middle, 0, 10)).toBe(true)
    expect(canScroll(middle, 0, -10)).toBe(true)
  })

  test('at the end, also with a rounding of less than one px, down goes to the canvas', () => {
    expect(canScroll({ ...box, scrollTop: 200 }, 0, 10)).toBe(false)
    expect(canScroll({ ...box, scrollTop: 199.5 }, 0, 10)).toBe(false)
    expect(canScroll({ ...box, scrollTop: 200 }, 0, -10)).toBe(true)
  })

  test('a box with no horizontal overflow leaves a horizontal wheel to the canvas', () => {
    expect(canScroll(box, 10, 0)).toBe(false)
    expect(canScroll(box, -10, 0)).toBe(false)
    const wide = { ...box, scrollWidth: 400, scrollLeft: 50 }
    expect(canScroll(wide, 10, 0)).toBe(true)
    expect(canScroll(wide, -10, 0)).toBe(true)
  })

  test('a diagonal wheel goes to the box when it can scroll in one of the two directions', () => {
    // At the top of a box that scrolls sideways: up cannot scroll, right can.
    const wide = { ...box, scrollWidth: 400 }
    expect(canScroll(wide, 10, -10)).toBe(true)
    // At the right end and the top: neither direction can scroll.
    expect(canScroll({ ...wide, scrollLeft: 200 }, 10, -10)).toBe(false)
  })

  test('no delta scrolls nothing', () => {
    expect(canScroll({ ...box, scrollTop: 100 }, 0, 0)).toBe(false)
  })
})

describe('revealView', () => {
  const size = { width: 1000, height: 600 }
  const strips = { top: 48, bottom: 64 }
  const view: View = { x: 10, y: 20, scale: 0.5 }

  test('an element in the free part keeps the view', () => {
    expect(revealView(view, { x: 400, y: 200, width: 100, height: 40 }, size, 48, strips)).toBe(view)
  })

  test('an element under the toolbar moves to the middle of the free part', () => {
    const next = revealView(view, { x: 480, y: 540, width: 40, height: 20 }, size, 48, strips)
    expect(next).toEqual({ x: 10, y: 20 + 292 - 550, scale: 0.5 })
  })
})

describe('titleRowRect', () => {
  test('the row above the top left corner of the frame, as wide as the frame on the screen', () => {
    const view: View = { x: 100, y: 50, scale: 0.5 }
    expect(titleRowRect(view, { x: 200, y: 400, width: 400, height: 900 }, 24, 320)).toEqual({ x: 200, y: 226, width: 200, height: 24 })
  })

  test('a wide frame gives at most the largest width', () => {
    const view: View = { x: 0, y: 0, scale: 1 }
    expect(titleRowRect(view, { x: 0, y: 100, width: 1440, height: 900 }, 24, 320).width).toBe(320)
  })
})
