import { describe, expect, test } from 'vitest'
import type { Change, Edit, Target } from '../../requests/format.ts'
import type { Item, PlacedEdit } from '../edits/model.ts'
import { editMarks, markPoint } from './edit-marks.ts'
import type { Rect } from './viewport.ts'

function target(line: number, column = 5): Target {
  return { file: 'screens/a.tsx', line, column, tag: 'Card', origin: 'library', element: 'div', copies: 1, label: '' }
}

function item(id: string, at: Target | null, change: Change, extra: Partial<Item> = {}, edit: Partial<Edit> = {}): Item {
  return { edit: { id, target: at, width: 1440, change, ...edit }, ...extra }
}

const text = (after: string): Change => ({ kind: 'text', before: 'Old', after })
const style: Change = {
  kind: 'style',
  properties: ['align-items'],
  before: { value: 'center', observed: true },
  after: { value: 'flex-start' },
}
const remove: Change = { kind: 'remove' }
const comment: Change = { kind: 'comment', text: 'Make it shorter' }

function rectAt(line: number): Rect {
  return { x: 10, y: line * 10, width: 100, height: 20 }
}

// Each element is found, at a rectangle from its line.
const found = (edit: PlacedEdit) => rectAt(edit.target.line)

describe('editMarks', () => {
  test('no edit gives no mark', () => {
    expect(editMarks([], found)).toEqual([])
  })

  test('two edits on one element are one mark with their count', () => {
    const items = [item('e1', target(7), text('New')), item('e2', target(7), style)]
    expect(editMarks(items, found)).toEqual([{ key: 'screens/a.tsx:7:5', count: 2, rect: rectAt(7) }])
  })

  test('each element gets its own mark, in the order of its first edit', () => {
    const items = [item('e1', target(9), style), item('e2', target(3), text('New')), item('e3', target(9), text('A'))]
    expect(editMarks(items, found).map((mark) => [mark.key, mark.count])).toEqual([
      ['screens/a.tsx:9:5', 2],
      ['screens/a.tsx:3:5', 1],
    ])
  })

  test('a stale edit and an edit with a reply have no preview and give no mark', () => {
    const items = [
      item('e1', target(4), style, { stale: true }),
      item('e2', target(5), text('New'), {}, { reply: { status: 'conflict', text: 'The code has a newer text.' } }),
      item('e3', target(5), style),
    ]
    expect(editMarks(items, found)).toEqual([{ key: 'screens/a.tsx:5:5', count: 1, rect: rectAt(5) }])
  })

  test('a comment, an options item and a keep item give no mark', () => {
    const items = [
      item('e1', target(4), comment),
      item('e2', null, comment),
      item('e3', target(6), { kind: 'options', count: 3, note: '' }),
      item('e4', null, { kind: 'keep', option: 'a-option-1' }),
    ]
    expect(editMarks(items, found)).toEqual([])
  })

  test('a removed element, which the preview hides, gets no mark', () => {
    const items = [item('e1', target(4), text('New')), item('e2', target(4), remove), item('e3', target(8), style)]
    // The preview hides the removed element: its node gives no rectangle.
    const rectOf = (edit: PlacedEdit) => (edit.target.line === 4 ? null : rectAt(edit.target.line))
    expect(editMarks(items, rectOf)).toEqual([{ key: 'screens/a.tsx:8:5', count: 1, rect: rectAt(8) }])
  })

  test('rectOf is called once for each place', () => {
    const items = [item('e1', target(4), text('New')), item('e2', target(4), style), item('e3', target(8), style)]
    const calls: string[] = []
    editMarks(items, (edit) => {
      calls.push(edit.id)
      return rectAt(edit.target.line)
    })
    expect(calls).toEqual(['e1', 'e3'])
  })
})

describe('markPoint', () => {
  test('the middle of the mark is at the bottom left corner of the element', () => {
    expect(markPoint({ x: 10, y: 20, width: 100, height: 40 }, 8)).toEqual({ x: 6, y: 56 })
  })
})
