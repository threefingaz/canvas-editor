import { describe, expect, test } from 'vitest'
import {
  centerOn,
  clampScale,
  maxScale,
  minScale,
  pan,
  toScreen,
  toWorld,
  wheelDelta,
  wheelZoomFactor,
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
    const view = centerOn({ x: 0, y: 0, width: 400, height: 200 }, size)
    expect(view.scale).toBe(1)
    expect(toScreen(view, { x: 200, y: 100 })).toEqual({ x: 600, y: 400 })
  })

  test('makes large content fit with a margin', () => {
    const bounds = { x: 0, y: 0, width: 4000, height: 1000 }
    const view = centerOn(bounds, size, 50)
    expect(view.scale).toBeCloseTo(1100 / 4000)
    const topLeft = toScreen(view, { x: 0, y: 0 })
    const bottomRight = toScreen(view, { x: 4000, y: 1000 })
    expect(topLeft.x).toBeCloseTo(50)
    expect(bottomRight.x).toBeCloseTo(1150)
    expect((topLeft.y + bottomRight.y) / 2).toBeCloseTo(400)
  })

  test('uses the height when the height limits', () => {
    const view = centerOn({ x: 100, y: 100, width: 500, height: 3000 }, size, 0)
    expect(view.scale).toBeCloseTo(800 / 3000)
    const middle = toScreen(view, { x: 350, y: 1600 })
    expect(middle.x).toBeCloseTo(600)
    expect(middle.y).toBeCloseTo(400)
  })

  test('respects the minimum scale for very large content', () => {
    const view = centerOn({ x: 0, y: 0, width: 1e7, height: 1e7 }, size)
    expect(view.scale).toBe(minScale)
  })

  test('gives scale 1 with the point in the middle for empty bounds', () => {
    const view = centerOn({ x: 10, y: 20, width: 0, height: 0 }, size)
    expect(view.scale).toBe(1)
    expect(toScreen(view, { x: 10, y: 20 })).toEqual({ x: 600, y: 400 })
  })

  test('gives scale 1 when the canvas has no size yet', () => {
    const view = centerOn({ x: 0, y: 0, width: 400, height: 200 }, { width: 0, height: 0 })
    expect(view.scale).toBe(1)
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
