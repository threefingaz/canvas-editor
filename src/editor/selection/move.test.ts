import { describe, expect, test } from 'vitest'
import type { Edit, Target } from '../../requests/format.ts'
import { addEdit, discard, type Item } from '../edits/model.ts'
import { movePlan, orderEdit } from '../inspector/edit.ts'
import { arrowNext, arrowsOf, flowOf, selectionMove, showsPlan, shownOrder, stepOf, type Arrow, type Flow } from './move.ts'

describe('shownOrder', () => {
  test('with no order the sequence is the index', () => {
    expect(shownOrder([{ order: 0 }, { order: 0 }, { order: 0 }])).toEqual([0, 1, 2])
  })

  test('one moved child goes to its place', () => {
    // The preview of a move from 2 to 0 gives the orders 1, 2, 0.
    expect(shownOrder([{ order: 1 }, { order: 2 }, { order: 0 }])).toEqual([2, 0, 1])
  })

  test('equal values keep the index', () => {
    expect(shownOrder([{ order: 1 }, { order: 0 }, { order: 1 }, { order: 0 }])).toEqual([1, 3, 0, 2])
  })

  test('a negative value comes first', () => {
    expect(shownOrder([{ order: 0 }, { order: 0 }, { order: -1 }])).toEqual([2, 0, 1])
  })

  test('a value that is not a number counts as 0', () => {
    expect(shownOrder([{ order: 1 }, { order: Number.NaN }])).toEqual([1, 0])
  })
})

describe('arrowNext at the ends of the sequence', () => {
  // In a plain column Up is a step earlier in the code, Down a step later.
  const column: Flow = { axis: 'column', reversed: false }

  test('in the middle each step is possible', () => {
    expect(arrowNext('up', column, 1, 3)).toBe(0)
    expect(arrowNext('down', column, 1, 3)).toBe(2)
  })

  test('at the first place no step goes earlier', () => {
    expect(arrowNext('up', column, 0, 3)).toBeNull()
    expect(arrowNext('down', column, 0, 3)).toBe(1)
  })

  test('at the last place no step goes later', () => {
    expect(arrowNext('down', column, 2, 3)).toBeNull()
    expect(arrowNext('up', column, 2, 3)).toBe(1)
  })

  test('one element has no step', () => {
    expect(arrowNext('up', column, 0, 1)).toBeNull()
    expect(arrowNext('down', column, 0, 1)).toBeNull()
  })
})

describe('selectionMove', () => {
  const plan = { position: 1, count: 3, previewed: true, replaced: [] }
  // An order item of a sibling.
  const order = (id: string, extra: Partial<Item> = {}, reply?: Edit['reply']): Item => ({
    edit: {
      id,
      target: { file: 'screens/a.tsx', line: 4, column: 7, tag: 'Button', origin: 'library', element: 'button', copies: 1, label: '' },
      width: 1440,
      change: { kind: 'order', before: 0, after: 2, of: 3, previewed: true },
      ...(reply ? { reply } : {}),
    },
    ...extra,
  })

  test('no plan gives no move', () => {
    expect(selectionMove(null, [])).toBeNull()
  })

  test('a plan with a preview can drag', () => {
    expect(selectionMove(plan, [])).toEqual({ ...plan, drag: true })
  })

  test('a parent with no preview gives no drag', () => {
    expect(selectionMove({ ...plan, previewed: false }, [])).toEqual({ ...plan, previewed: false, drag: false })
  })

  test('a sibling with a live move gives no drag', () => {
    const move = selectionMove({ ...plan, replaced: ['e1'] }, [order('e1')])
    expect(move?.drag).toBe(false)
    expect(move?.replaced).toEqual(['e1'])
  })

  test('a stale or replied sibling edit is no open move and keeps the drag', () => {
    const items = [order('e1', { stale: true }), order('e2', {}, { status: 'unclear', text: 'Which one?' })]
    const move = selectionMove({ ...plan, replaced: ['e1', 'e2'] }, items)
    expect(move?.drag).toBe(true)
  })

  test('a live edit that is not replaced does not count', () => {
    expect(selectionMove(plan, [order('e1')])?.drag).toBe(true)
  })
})

describe('showsPlan', () => {
  const plan = (position: number, count = 3) => ({ position, count })

  test('the sequence of the code with no own move', () => {
    expect(showsPlan([0, 1, 2], 1, plan(1))).toBe(true)
  })

  test('the own move applied: A from 0 to 2 shows B, C, A', () => {
    expect(showsPlan([1, 2, 0], 2, plan(2))).toBe(true)
  })

  test('the preview skipped the own move (no flex parent, or a skipped edit)', () => {
    // A moved from 0 to 1, the frame still shows A, B, C.
    expect(showsPlan([0, 1, 2], 0, plan(1))).toBe(false)
  })

  test('a different sibling has an open move', () => {
    // A moved from 0 to 2: the frame shows B, C, A; C is selected (code 2).
    expect(showsPlan([1, 2, 0], 1, plan(2))).toBe(false)
  })

  test('the library sets the order itself', () => {
    // The frame shows A, C, B; C is selected (code 2).
    expect(showsPlan([0, 2, 1], 1, plan(2))).toBe(false)
    // B is selected (code 1): its place is right, but C is not.
    expect(showsPlan([0, 2, 1], 2, plan(1))).toBe(false)
  })

  test('a count or a place that does not agree', () => {
    expect(showsPlan([0, 1], 0, plan(0))).toBe(false)
    expect(showsPlan([0, 1, 2], 3, plan(0))).toBe(false)
  })
})

// A rectangle of 80 by 40 at the column `x` and the line `y` of a grid of
// 100 px cells.
const cell = (x: number, y: number) => ({ x: x * 100, y: y * 100, width: 80, height: 40 })

describe('flowOf', () => {
  const row = [cell(0, 0), cell(1, 0), cell(2, 0)]
  const column = [cell(0, 0), cell(0, 1), cell(0, 2)]

  test('siblings on one line are a row', () => {
    expect(flowOf(row, 1, 'flex')).toEqual({ axis: 'row', reversed: false })
  })

  test('siblings below each other are a column', () => {
    expect(flowOf(column, 1, 'flex')).toEqual({ axis: 'column', reversed: false })
  })

  test('a row whose later siblings are at the left is reversed', () => {
    expect(flowOf([cell(2, 0), cell(1, 0), cell(0, 0)], 1, 'flex')).toEqual({ axis: 'row', reversed: true })
  })

  test('a column whose later siblings are above is reversed', () => {
    expect(flowOf([cell(0, 2), cell(0, 1), cell(0, 0)], 0, 'flex')).toEqual({ axis: 'column', reversed: true })
  })

  test('the last element of a row reads the sibling before it', () => {
    expect(flowOf(row, 2, 'flex')).toEqual({ axis: 'row', reversed: false })
  })

  test('the last element of the first line of a wrapped row is in a row', () => {
    const wrapped = [cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1), cell(1, 1)]
    expect(flowOf(wrapped, 2, 'flex')).toEqual({ axis: 'row', reversed: false })
  })

  test('a grid of two columns is a row', () => {
    const grid = [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)]
    expect(flowOf(grid, 2, 'grid')).toEqual({ axis: 'row', reversed: false })
    expect(flowOf(grid, 1, 'grid')).toEqual({ axis: 'row', reversed: false })
  })

  test('a parent with no container is a column, also with the rectangles of a row', () => {
    expect(flowOf(row, 1, null)).toEqual({ axis: 'column', reversed: false })
  })

  test('a sibling with no size does not count', () => {
    const hidden = { x: 0, y: 0, width: 0, height: 0 }
    expect(flowOf([hidden, cell(1, 0), cell(1, 1)], 1, 'flex')).toEqual({ axis: 'column', reversed: false })
    expect(flowOf([cell(0, 0), hidden, cell(2, 0)], 2, 'flex')).toEqual({ axis: 'row', reversed: false })
  })

  test('one element is a column that is not reversed', () => {
    expect(flowOf([cell(0, 0)], 0, 'flex')).toEqual({ axis: 'column', reversed: false })
  })

  test('an element with no size is a column that is not reversed', () => {
    expect(flowOf([cell(0, 0), { x: 100, y: 0, width: 0, height: 0 }], 1, 'flex')).toEqual({
      axis: 'column',
      reversed: false,
    })
  })
})

describe('arrowsOf', () => {
  test('a row has Left and Right, a column Up and Down, the left or upper one first', () => {
    expect(arrowsOf('row')).toEqual(['left', 'right'])
    expect(arrowsOf('column')).toEqual(['up', 'down'])
  })
})

describe('stepOf', () => {
  const cases: [Flow, Partial<Record<Arrow, -1 | 1>>][] = [
    [{ axis: 'row', reversed: false }, { left: -1, right: 1 }],
    [{ axis: 'row', reversed: true }, { left: 1, right: -1 }],
    [{ axis: 'column', reversed: false }, { up: -1, down: 1 }],
    [{ axis: 'column', reversed: true }, { up: 1, down: -1 }],
  ]
  const arrows: Arrow[] = ['left', 'right', 'up', 'down']

  for (const [flow, steps] of cases) {
    test(`the arrows in a ${flow.reversed ? 'reversed ' : ''}${flow.axis}`, () => {
      for (const arrow of arrows) expect(stepOf(arrow, flow)).toBe(steps[arrow] ?? null)
    })
  }
})

describe('arrowNext', () => {
  const flows: Record<string, Flow> = {
    row: { axis: 'row', reversed: false },
    reversedRow: { axis: 'row', reversed: true },
    column: { axis: 'column', reversed: false },
    reversedColumn: { axis: 'column', reversed: true },
  }

  test('a row: left is earlier, right is later; up and down do nothing', () => {
    expect(arrowNext('left', flows.row!, 1, 3)).toBe(0)
    expect(arrowNext('right', flows.row!, 1, 3)).toBe(2)
    expect(arrowNext('up', flows.row!, 1, 3)).toBeNull()
    expect(arrowNext('down', flows.row!, 1, 3)).toBeNull()
  })

  test('a reversed row: left is later', () => {
    expect(arrowNext('left', flows.reversedRow!, 1, 3)).toBe(2)
    expect(arrowNext('right', flows.reversedRow!, 1, 3)).toBe(0)
    // At the last place in the sequence the left arrow is off.
    expect(arrowNext('left', flows.reversedRow!, 2, 3)).toBeNull()
    expect(arrowNext('right', flows.reversedRow!, 2, 3)).toBe(1)
  })

  test('a column: up is earlier, down is later; left and right do nothing', () => {
    expect(arrowNext('up', flows.column!, 0, 3)).toBeNull()
    expect(arrowNext('down', flows.column!, 0, 3)).toBe(1)
    expect(arrowNext('left', flows.column!, 1, 3)).toBeNull()
  })

  test('a reversed column: up is later', () => {
    expect(arrowNext('up', flows.reversedColumn!, 0, 3)).toBe(1)
    expect(arrowNext('down', flows.reversedColumn!, 0, 3)).toBeNull()
  })
})

// The arrows of the bar and the keys step in the code sequence from the
// position of the plan, also when the frame shows a different sequence.
describe('an arrow step with the edits', () => {
  const column: Flow = { axis: 'column', reversed: false }
  const target = (line: number): Target => ({
    file: 'screens/a.tsx', line, column: 7, tag: 'div', origin: 'host', element: 'div', copies: 1, label: '',
  })
  // The three siblings A, B, C at the lines 4, 5 and 6.
  const locs = ['screens/a.tsx:4:7', 'screens/a.tsx:5:7', 'screens/a.tsx:6:7']
  let count = 0

  // One arrow on the sibling `index`, as `moveTo` does it; the list is the
  // same when the arrow does nothing.
  const step = (list: Item[], index: number, arrow: Arrow, container: 'flex' | null): Item[] => {
    const plan = movePlan(locs[index]!, { position: index, count: 3, container, movable: true }, list, () => true)
    const move = selectionMove(plan, list)!
    const next = arrowNext(arrow, column, move.position, move.count)
    if (next === null) return list
    const edit = orderEdit(move.position, next, move.count, move.previewed, target(4 + index), 1440, `e${++count}`)
    return edit ? addEdit(move.replaced.reduce(discard, list), edit) : list
  }
  const orders = (list: Item[]) =>
    list.map((item) => (item.edit.change.kind === 'order' ? [item.edit.target?.line, item.edit.change.before, item.edit.change.after] : null))

  test('a parent with no preview: two steps down and one back', () => {
    // The frame keeps A, B, C: the steps come from the plan, not the frame.
    let list: Item[] = []
    list = step(list, 0, 'down', null)
    expect(orders(list)).toEqual([[4, 0, 1]])
    list = step(list, 0, 'down', null)
    expect(orders(list)).toEqual([[4, 0, 2]])
    // At the last place, down does nothing.
    expect(step(list, 0, 'down', null)).toBe(list)
    list = step(list, 0, 'up', null)
    expect(orders(list)).toEqual([[4, 0, 1]])
    list = step(list, 0, 'up', null)
    expect(orders(list)).toEqual([])
  })

  test('a sibling with an open move: a plain code step, and the sibling goes back', () => {
    // A moved from 0 to 2: the frame shows B, C, A. C (code 2) goes up: 2 to 1.
    let list: Item[] = step(step([], 0, 'down', 'flex'), 0, 'down', 'flex')
    expect(orders(list)).toEqual([[4, 0, 2]])
    const up = step(list, 2, 'up', 'flex')
    expect(orders(up)).toEqual([[6, 2, 1]])
    // Down: C is at the end of the code sequence, thus nothing.
    expect(step(list, 2, 'down', 'flex')).toBe(list)
    // B (code 1) goes down: 1 to 2, and A goes back.
    list = step(list, 1, 'down', 'flex')
    expect(orders(list)).toEqual([[5, 1, 2]])
  })

  test('the library sets the order: the step is in the code sequence', () => {
    // The frame shows A, C, B, the list has no edit. C (code 2): up gives 2
    // to 1, down does nothing, as the bar shows "3 of 3".
    expect(orders(step([], 2, 'up', 'flex'))).toEqual([[6, 2, 1]])
    expect(step([], 2, 'down', 'flex')).toEqual([])
  })
})
