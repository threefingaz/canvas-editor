import { describe, expect, test } from 'vitest'
import { canvasRectOf, toEditorRect, toFramePoint } from './geometry.ts'

// The frame shows at (100, 40) in the editor.
const frameRect = { x: 100, y: 40 }

describe('toFramePoint', () => {
  test('at scale 1 it is the offset from the frame', () => {
    expect(toFramePoint({ x: 150, y: 90 }, frameRect, 1)).toEqual({ x: 50, y: 50 })
  })

  test('at scale 0.5 a distance in the editor is twice as large in the frame', () => {
    expect(toFramePoint({ x: 150, y: 90 }, frameRect, 0.5)).toEqual({ x: 100, y: 100 })
  })

  test('at scale 2 a distance in the editor is half as large in the frame', () => {
    expect(toFramePoint({ x: 150, y: 90 }, frameRect, 2)).toEqual({ x: 25, y: 25 })
  })

  test('a point at the left and above the frame gives negative values', () => {
    expect(toFramePoint({ x: 90, y: 30 }, frameRect, 2)).toEqual({ x: -5, y: -5 })
  })
})

describe('toEditorRect', () => {
  const nodeRect = { x: 20, y: 10, width: 200, height: 48 }

  test('at scale 1 it moves the rectangle by the place of the frame', () => {
    expect(toEditorRect(nodeRect, frameRect, 1)).toEqual({ x: 120, y: 50, width: 200, height: 48 })
  })

  test('at scale 0.5 the rectangle is half as large', () => {
    expect(toEditorRect(nodeRect, frameRect, 0.5)).toEqual({ x: 110, y: 45, width: 100, height: 24 })
  })

  test('at scale 2 the rectangle is twice as large', () => {
    expect(toEditorRect(nodeRect, frameRect, 2)).toEqual({ x: 140, y: 60, width: 400, height: 96 })
  })

  test('is the inverse of toFramePoint for the corner', () => {
    for (const scale of [0.5, 1, 2]) {
      const rect = toEditorRect(nodeRect, frameRect, scale)
      expect(toFramePoint({ x: rect.x, y: rect.y }, frameRect, scale)).toEqual({ x: nodeRect.x, y: nodeRect.y })
    }
  })
})

describe('canvasRectOf', () => {
  const nodeRect = { x: 20, y: 10, width: 200, height: 48 }

  test('at scale 1 the frame box moves by the view', () => {
    expect(canvasRectOf({ x: 30, y: 40, scale: 1 }, { x: 100, y: 200 }, nodeRect)).toEqual({
      x: 150,
      y: 250,
      width: 200,
      height: 48,
    })
  })

  test('at scale 0.5 the box and the node are half as large', () => {
    expect(canvasRectOf({ x: 30, y: 40, scale: 0.5 }, { x: 100, y: 200 }, nodeRect)).toEqual({
      x: 30 + 50 + 10,
      y: 40 + 100 + 5,
      width: 100,
      height: 24,
    })
  })

  test('is toEditorRect at the place of the frame on the canvas', () => {
    const view = { x: -300, y: 12, scale: 2 }
    const box = { x: 80, y: 60 }
    expect(canvasRectOf(view, box, nodeRect)).toEqual(toEditorRect(nodeRect, { x: -140, y: 132 }, 2))
  })
})
