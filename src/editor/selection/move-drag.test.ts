import { describe, expect, test } from 'vitest'
import type { Rect } from '../canvas/viewport.ts'
import type { Flow } from './move.ts'
import {
  dragAfter,
  dragThreshold,
  dropLine,
  dropPosition,
  idleDrag,
  lineBox,
  pointIn,
  type Drag,
  type DragEvent,
} from './move-drag.ts'

const box = (x: number, y: number, width = 100, height = 40): Rect => ({ x, y, width, height })
const row: Flow = { axis: 'row', reversed: false }
const column: Flow = { axis: 'column', reversed: false }
const reversedRow: Flow = { axis: 'row', reversed: true }
const reversedColumn: Flow = { axis: 'column', reversed: true }

// Three siblings in a row and in a column, in the shown sequence.
const inRow = [box(0, 0), box(110, 0), box(220, 0)]
const inColumn = [box(0, 0), box(0, 50), box(0, 100)]

describe('dropPosition', () => {
  test('a row: before or after the nearest sibling by the side of its middle', () => {
    expect(dropPosition(inRow, 0, row, { x: 250, y: 20 })).toBe(1)
    expect(dropPosition(inRow, 0, row, { x: 300, y: 20 })).toBe(2)
    expect(dropPosition(inRow, 2, row, { x: 150, y: 20 })).toBe(1)
    expect(dropPosition(inRow, 2, row, { x: 190, y: 20 })).toBe(2)
  })

  test('a column reads the middle in y', () => {
    expect(dropPosition(inColumn, 0, column, { x: 50, y: 105 })).toBe(1)
    expect(dropPosition(inColumn, 0, column, { x: 50, y: 135 })).toBe(2)
    expect(dropPosition(inColumn, 2, column, { x: 50, y: 10 })).toBe(0)
  })

  test('a reversed row: the left side of a sibling is later in the code', () => {
    // The shown sequence lies from the right to the left.
    const rects = [box(220, 0), box(110, 0), box(0, 0)]
    expect(dropPosition(rects, 0, reversedRow, { x: 10, y: 20 })).toBe(2)
    expect(dropPosition(rects, 0, reversedRow, { x: 90, y: 20 })).toBe(1)
  })

  test('the pointer before the first sibling and after the last one', () => {
    expect(dropPosition(inRow, 2, row, { x: -20, y: 20 })).toBe(0)
    expect(dropPosition(inRow, 0, row, { x: 400, y: 20 })).toBe(2)
  })

  test('the pointer on the element itself keeps the position', () => {
    expect(dropPosition(inRow, 1, row, { x: 150, y: 20 })).toBe(1)
  })

  test('a wrapped row: a sibling on the second line', () => {
    const rects = [box(0, 0), box(110, 0), box(220, 0), box(0, 50), box(110, 50)]
    expect(dropPosition(rects, 0, row, { x: 130, y: 70 })).toBe(3)
    expect(dropPosition(rects, 0, row, { x: 190, y: 70 })).toBe(4)
  })

  test('a grid of two columns', () => {
    const rects = [box(0, 0), box(110, 0), box(0, 50), box(110, 50)]
    expect(dropPosition(rects, 3, row, { x: 20, y: 20 })).toBe(0)
    expect(dropPosition(rects, 3, row, { x: 30, y: 70 })).toBe(2)
    expect(dropPosition(rects, 3, row, { x: 80, y: 70 })).toBe(3)
  })

  test('the pointer out of all rectangles takes the nearest one', () => {
    expect(dropPosition(inRow, 0, row, { x: 400, y: 500 })).toBe(2)
    expect(dropPosition(inRow, 2, row, { x: -50, y: -50 })).toBe(0)
  })

  test('a reversed column: the top side of a sibling is later in the code', () => {
    // The shown sequence lies from the bottom to the top.
    const rects = [box(0, 100), box(0, 50), box(0, 0)]
    expect(dropPosition(rects, 0, reversedColumn, { x: 50, y: 5 })).toBe(2)
    expect(dropPosition(rects, 0, reversedColumn, { x: 50, y: 35 })).toBe(1)
    expect(dropPosition(rects, 2, reversedColumn, { x: 50, y: 135 })).toBe(0)
  })

  test('a reversed row: a sibling earlier in the sequence than the element', () => {
    const rects = [box(220, 0), box(110, 0), box(0, 0)]
    // The element is at 2 (at the left); the sibling 0 is at the right.
    expect(dropPosition(rects, 2, reversedRow, { x: 300, y: 20 })).toBe(0)
    expect(dropPosition(rects, 2, reversedRow, { x: 230, y: 20 })).toBe(1)
  })

  test('a pointer exactly at the middle of a sibling is after the middle', () => {
    expect(dropPosition(inRow, 0, row, { x: 160, y: 20 })).toBe(1)
    expect(dropPosition(inRow, 2, row, { x: 160, y: 20 })).toBe(2)
  })

  test('a sibling with no size does not count', () => {
    const rects = [box(0, 0), box(110, 0), box(250, 0, 0, 0)]
    expect(dropPosition(rects, 0, row, { x: 250, y: 20 })).toBe(1)
    expect(dropPosition([box(0, 0, 0, 0)], 0, row, { x: 0, y: 0 })).toBe(0)
  })
})

describe('dropLine', () => {
  test('before the first sibling', () => {
    expect(dropLine(inRow, 1, 0, row)).toEqual({ x: 0, y: 0, width: 0, height: 40 })
  })

  test('between two siblings: after the one the element goes past', () => {
    expect(dropLine(inRow, 0, 1, row)).toEqual({ x: 210, y: 0, width: 0, height: 40 })
    expect(dropLine(inRow, 2, 1, row)).toEqual({ x: 110, y: 0, width: 0, height: 40 })
  })

  test('after the last sibling', () => {
    expect(dropLine(inRow, 1, 2, row)).toEqual({ x: 320, y: 0, width: 0, height: 40 })
  })

  test('the same position gives no line', () => {
    expect(dropLine(inRow, 1, 1, row)).toBeNull()
  })

  test('a column gives a horizontal line', () => {
    expect(dropLine(inColumn, 0, 2, column)).toEqual({ x: 0, y: 140, width: 100, height: 0 })
    expect(dropLine(inColumn, 2, 0, column)).toEqual({ x: 0, y: 0, width: 100, height: 0 })
  })

  test('a drop next to a sibling with no size shows the line at the nearest sibling with a size on that side', () => {
    // After a hidden last sibling: the end of the row, after the second one.
    expect(dropLine([box(0, 0), box(110, 0), box(250, 0, 0, 0)], 0, 2, row)).toEqual({ x: 210, y: 0, width: 0, height: 40 })
    // A, hidden, B with the element at A: after the hidden one is before B.
    const hidden = [box(0, 0), box(0, 0, 0, 0), box(110, 0)]
    expect(dropPosition(hidden, 0, row, { x: 120, y: 20 })).toBe(1)
    expect(dropLine(hidden, 0, 1, row)).toEqual({ x: 110, y: 0, width: 0, height: 40 })
    // B, hidden, A with the element at A: before the hidden one is after B.
    const back = [box(0, 0), box(0, 0, 0, 0), box(110, 0)]
    expect(dropLine(back, 2, 1, row)).toEqual({ x: 100, y: 0, width: 0, height: 40 })
    // No sibling with a size on the side of the drop.
    expect(dropLine([box(0, 0), box(0, 0, 0, 0)], 0, 1, row)).toBeNull()
  })

  test('a reversed column puts a later drop above the sibling', () => {
    const rects = [box(0, 100), box(0, 50), box(0, 0)]
    expect(dropLine(rects, 0, 2, reversedColumn)).toEqual({ x: 0, y: 0, width: 100, height: 0 })
    expect(dropLine(rects, 2, 0, reversedColumn)).toEqual({ x: 0, y: 140, width: 100, height: 0 })
  })

  test('a reversed row puts a later drop at the left of the sibling', () => {
    const rects = [box(220, 0), box(110, 0), box(0, 0)]
    expect(dropLine(rects, 0, 2, reversedRow)).toEqual({ x: 0, y: 0, width: 0, height: 40 })
  })
})

describe('dragAfter', () => {
  // A press that can drag the element at the position 1, or one that cannot
  // (not on the element, or no drag possible).
  const press = (canDrag = true): DragEvent => ({ type: 'press', point: { x: 10, y: 10 }, position: canDrag ? 1 : null })
  const move = (dx: number, drop = 1, scale = 1, down = true): DragEvent => ({
    type: 'move',
    point: { x: 10 + dx, y: 10 },
    drop,
    down,
    scale,
  })
  const run = (events: DragEvent[], from: Drag = idleDrag) => {
    let state = from
    const results = events.map((event) => {
      const result = dragAfter(state, event)
      state = result.state
      return result
    })
    return { state, results }
  }

  test('a press that cannot drag stays idle', () => {
    expect(dragAfter(idleDrag, press(false)).state).toBe(idleDrag)
  })

  test('the threshold is on the screen: the zoom of the canvas scales the movement', () => {
    // At 5 % a movement of 40 px of the frame document is 2 px on the screen.
    expect(run([press(), move(40, 2, 0.05)]).state.kind).toBe('pressed')
    expect(run([press(), move(dragThreshold / 0.05, 2, 0.05)]).state.kind).toBe('dragging')
    // At 200 % a movement of 2 px of the frame document is 4 px on the screen.
    expect(run([press(), move(dragThreshold / 2, 2, 2)]).state.kind).toBe('dragging')
    expect(run([press(), move(1, 2, 2)]).state.kind).toBe('pressed')
  })

  test('a move with no button down ends a press: its release came out of the overlay', () => {
    const { results } = run([press(), move(1), move(10, 2, 1, false), { type: 'click' }])
    expect(results[2]).toEqual({ state: idleDrag, moveTo: null, stopClick: false })
    expect(results[3]!.stopClick).toBe(false)
  })

  test('a move with no button down ends a drag with no move, and its click is stopped', () => {
    const { results } = run([press(), move(10, 2), move(20, 0, 1, false), { type: 'release' }, { type: 'click' }])
    expect(results[2]).toEqual({ state: { kind: 'idle', guard: true }, moveTo: null, stopClick: false })
    expect(results[3]!.moveTo).toBeNull()
    expect(results[4]!.stopClick).toBe(true)
  })

  test('a cancel of a press is idle with no guard, thus the next click is a pick', () => {
    const { results } = run([press(), move(1), { type: 'cancel' }, { type: 'click' }])
    expect(results[2]!.state).toBe(idleDrag)
    expect(results[3]!.stopClick).toBe(false)
  })

  test('settled and click with no guard change nothing', () => {
    expect(dragAfter(idleDrag, { type: 'settled' })).toEqual({ state: idleDrag, moveTo: null, stopClick: false })
    expect(dragAfter(idleDrag, { type: 'click' })).toEqual({ state: idleDrag, moveTo: null, stopClick: false })
  })

  test('a press on the element during the guard drops the guard and starts a press', () => {
    const { state } = run([press(), move(10, 0), { type: 'release' }, press()])
    expect(state).toEqual({ kind: 'pressed', start: { x: 10, y: 10 }, from: 1 })
  })

  test('a press while pressed changes nothing', () => {
    const pressed = dragAfter(idleDrag, press()).state
    expect(dragAfter(pressed, press()).state).toBe(pressed)
  })

  test('a move below the threshold stays pressed', () => {
    const { state } = run([press(), move(dragThreshold - 1)])
    expect(state.kind).toBe('pressed')
  })

  test('a move of the threshold or more starts the drag', () => {
    const { state } = run([press(), move(dragThreshold, 2)])
    expect(state).toEqual({ kind: 'dragging', start: { x: 10, y: 10 }, from: 1, drop: 2 })
  })

  test('a release of a press gives no move and stops no click', () => {
    const { results } = run([press(), move(1), { type: 'release' }, { type: 'click' }])
    expect(results[2]).toEqual({ state: idleDrag, moveTo: null, stopClick: false })
    expect(results[3]!.stopClick).toBe(false)
  })

  test('a release of a drag gives the move and sets the guard', () => {
    const { results } = run([press(), move(10, 0), { type: 'release' }])
    expect(results[2]).toEqual({ state: { kind: 'idle', guard: true }, moveTo: 0, stopClick: false })
  })

  test('the click after a drag is stopped one time', () => {
    const { results } = run([press(), move(10, 0), { type: 'release' }, { type: 'click' }, { type: 'click' }])
    expect(results[3]!.stopClick).toBe(true)
    expect(results[4]!.stopClick).toBe(false)
  })

  test('a release that no click follows stops no later click', () => {
    const settled = run([press(), move(10, 0), { type: 'release' }, { type: 'settled' }, { type: 'click' }])
    expect(settled.results[4]!.stopClick).toBe(false)
    const pressed = run([press(), move(10, 0), { type: 'release' }, press(false), { type: 'click' }])
    expect(pressed.results[3]!.state).toBe(idleDrag)
    expect(pressed.results[4]!.stopClick).toBe(false)
  })

  test('a release at the same position gives no move', () => {
    const { results } = run([press(), move(10, 2), move(20, 1), { type: 'release' }])
    expect(results[3]!.moveTo).toBeNull()
  })

  test('a cancel gives no move, and the release after it gives none', () => {
    const { results } = run([press(), move(10, 0), { type: 'cancel' }, { type: 'release' }, { type: 'click' }])
    expect(results[2]!.moveTo).toBeNull()
    expect(results[2]!.state).toEqual({ kind: 'idle', guard: true })
    expect(results[3]!.moveTo).toBeNull()
    expect(results[4]!.stopClick).toBe(true)
  })

  test('an event that changes nothing gives the same state', () => {
    expect(dragAfter(idleDrag, { type: 'release' }).state).toBe(idleDrag)
    expect(dragAfter(idleDrag, move(10)).state).toBe(idleDrag)
    const dragging = run([press(), move(10, 2)]).state
    expect(dragAfter(dragging, move(30, 2)).state).toBe(dragging)
    expect(dragAfter(dragging, press()).state).toBe(dragging)
  })
})

describe('pointIn', () => {
  const rect = { x: 10, y: 20, width: 30, height: 40 }

  test('a point inside and on the edges is in the rectangle', () => {
    expect(pointIn(rect, { x: 20, y: 30 })).toBe(true)
    expect(pointIn(rect, { x: 10, y: 20 })).toBe(true)
    expect(pointIn(rect, { x: 40, y: 60 })).toBe(true)
  })

  test('a point outside is not', () => {
    expect(pointIn(rect, { x: 9, y: 30 })).toBe(false)
    expect(pointIn(rect, { x: 20, y: 61 })).toBe(false)
  })
})

describe('lineBox', () => {
  test('a vertical line gets the thickness across it', () => {
    expect(lineBox({ x: 100, y: 10, width: 0, height: 50 }, 2)).toEqual({ x: 99, y: 10, width: 2, height: 50 })
  })

  test('a horizontal line gets the thickness across it', () => {
    expect(lineBox({ x: 10, y: 100, width: 80, height: 0 }, 2)).toEqual({ x: 10, y: 99, width: 80, height: 2 })
  })
})
