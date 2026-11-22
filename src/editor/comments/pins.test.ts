import { describe, expect, test } from 'vitest'
import type { Change, Edit, Target } from '../../requests/format.ts'
import type { Rect } from '../canvas/viewport.ts'
import { locOf, type Item, type PlacedEdit } from '../edits/model.ts'
import { lostPin, pinOfComment, pinPoint, pinsOf, screenPin, type Pin } from './pins.ts'

function target(line: number, column = 5): Target {
  return { file: 'screens/a.tsx', line, column, tag: 'Card', origin: 'library', element: 'div', copies: 1, label: '' }
}

function comment(id: string, at: Target | null, extra: Partial<Edit> = {}): Item {
  return { edit: { id, target: at, width: 1440, change: { kind: 'comment', text: `Task ${id}` }, ...extra } }
}

function rectAt(line: number): Rect {
  return { x: 10, y: line * 10, width: 100, height: 20 }
}

// Each element is found, at a rectangle from its line.
const found = (edit: PlacedEdit) => rectAt(edit.target.line)

describe('pinsOf', () => {
  test('no comment gives no pin', () => {
    const remove: Change = { kind: 'remove' }
    const items: Item[] = [{ edit: { id: 'e1', target: target(3), width: 1440, change: remove } }]
    expect(pinsOf([], found)).toEqual([])
    expect(pinsOf(items, found)).toEqual([])
  })

  test('two comments on one element are one pin with both ids, in the order of the list', () => {
    const items = [comment('e2', target(7)), comment('e1', target(7))]
    expect(pinsOf(items, found)).toEqual([
      { key: 'screens/a.tsx:7:5', ids: ['e2', 'e1'], number: 1, rect: rectAt(7), replied: false },
    ])
  })

  test('the pins on elements are numbered in the order of the code, then the pins of the title row', () => {
    const items = [
      comment('e1', null),
      comment('e2', target(9)),
      comment('e3', target(4, 12)),
      comment('e4', target(4, 3)),
    ]
    expect(pinsOf(items, found).map((pin) => [pin.key, pin.number])).toEqual([
      ['screens/a.tsx:4:3', 1],
      ['screens/a.tsx:4:12', 2],
      ['screens/a.tsx:9:5', 3],
      ['screen', 4],
    ])
  })

  test('a comment added before a pin gives that pin a new number', () => {
    const before = [comment('e1', target(9))]
    const after = [...before, comment('e2', target(2))]
    expect(pinsOf(before, found)[0].number).toBe(1)
    const pins = pinsOf(after, found)
    expect(pins.find((pin) => pin.ids.includes('e1'))?.number).toBe(2)
    expect(pins.find((pin) => pin.ids.includes('e2'))?.number).toBe(1)
  })

  test('the comments on the screen are the pin `screen`, with no rectangle', () => {
    const items = [comment('e1', null), comment('e2', null)]
    expect(pinsOf(items, found)).toEqual([{ key: 'screen', ids: ['e1', 'e2'], number: 1, rect: null, replied: false }])
  })

  test('a stale comment is in the pin `lost`, and its place is not measured', () => {
    const asked: string[] = []
    const rectOf = (edit: PlacedEdit) => {
      asked.push(edit.id)
      return found(edit)
    }
    const items: Item[] = [{ ...comment('e1', target(3)), stale: true }, comment('e2', target(5))]
    expect(pinsOf(items, rectOf)).toEqual([
      { key: 'screens/a.tsx:5:5', ids: ['e2'], number: 1, rect: rectAt(5), replied: false },
      { key: 'lost', ids: ['e1'], number: 2, rect: null, replied: false },
    ])
    expect(asked).toEqual(['e2'])
  })

  test('a stale comment does not join the pin of a live comment on the same place', () => {
    const items: Item[] = [comment('e1', target(3)), { ...comment('e2', target(3)), stale: true }]
    expect(pinsOf(items, found).map((pin) => [pin.key, pin.ids])).toEqual([
      ['screens/a.tsx:3:5', ['e1']],
      ['lost', ['e2']],
    ])
  })

  test('a hidden or missing element puts its comments into the pin `lost`, after the pin `screen`', () => {
    const hidden = target(3)
    const rectOf = (edit: PlacedEdit) => (locOf(edit.target) === locOf(hidden) ? null : found(edit))
    const items = [comment('e1', hidden), comment('e2', null), comment('e3', target(8)), comment('e4', hidden)]
    expect(pinsOf(items, rectOf)).toEqual([
      { key: 'screens/a.tsx:8:5', ids: ['e3'], number: 1, rect: rectAt(8), replied: false },
      { key: 'screen', ids: ['e2'], number: 2, rect: null, replied: false },
      { key: 'lost', ids: ['e1', 'e4'], number: 3, rect: null, replied: false },
    ])
  })

  test('the lost comments keep the order of the list, stale or not found', () => {
    const rectOf = (edit: PlacedEdit) => (edit.target.line === 2 ? null : found(edit))
    const items: Item[] = [comment('e1', target(2)), { ...comment('e2', target(6)), stale: true }, comment('e3', target(2))]
    expect(pinsOf(items, rectOf)).toEqual([{ key: 'lost', ids: ['e1', 'e2', 'e3'], number: 1, rect: null, replied: false }])
  })

  test('one reply of the agent marks its pin', () => {
    const reply = { status: 'unclear', text: 'Which plans?' } as const
    const items = [comment('e1', target(3)), comment('e2', target(3), { reply }), comment('e3', target(6)), comment('e4', null, { reply })]
    expect(pinsOf(items, found).map((pin) => [pin.key, pin.replied])).toEqual([
      ['screens/a.tsx:3:5', true],
      ['screens/a.tsx:6:5', false],
      ['screen', true],
    ])
  })

  test('the other edits of the screen give no pin', () => {
    const items: Item[] = [
      { edit: { id: 'e1', target: target(3), width: 1440, change: { kind: 'text', before: 'A', after: 'B' } } },
      { edit: { id: 'e2', target: null, width: 1440, change: { kind: 'options', count: 3, note: '' } } },
      { edit: { id: 'e3', target: null, width: 1440, change: { kind: 'keep', option: 'a/b-option-1' } } },
      comment('e4', target(3)),
    ]
    expect(pinsOf(items, found).map((pin) => pin.ids)).toEqual([['e4']])
  })
})

describe('pinPoint', () => {
  test('puts the middle of the pin at the top right corner of the element', () => {
    expect(pinPoint({ x: 10, y: 30, width: 100, height: 20 }, 20)).toEqual({ x: 100, y: 20 })
  })

  test('an element with no size gets the pin at its point', () => {
    expect(pinPoint({ x: 50, y: 50, width: 0, height: 0 }, 16)).toEqual({ x: 42, y: 42 })
  })

  test('works with negative coordinates (an element out of the view)', () => {
    expect(pinPoint({ x: -200, y: -80, width: 40, height: 10 }, 20)).toEqual({ x: -170, y: -90 })
  })
})

describe('pinOfComment', () => {
  const placed = comment('e1', target(7))
  const onScreen = comment('e2', null)
  const stale: Item = { ...comment('e3', target(9)), stale: true }

  test('the pin of the list that has the comment', () => {
    const pins: Pin[] = [
      { key: 'screens/a.tsx:7:5', ids: ['e0', 'e1'], number: 1, rect: rectAt(7), replied: false },
      { key: lostPin, ids: ['e3'], number: 2, rect: null, replied: false },
    ]
    expect(pinOfComment(pins, placed)).toBe(pins[0])
    expect(pinOfComment(pins, stale)).toBe(pins[1])
  })

  test('while the pins are not known: the screen, the lost pin for a stale item, else its element', () => {
    expect(pinOfComment(null, onScreen)).toEqual({ key: screenPin, ids: ['e2'] })
    expect(pinOfComment(null, stale)).toEqual({ key: lostPin, ids: ['e3'] })
    expect(pinOfComment(null, placed)).toEqual({ key: 'screens/a.tsx:7:5', ids: ['e1'] })
  })

  test('a comment that no pin of the list has gets a pin of its own', () => {
    expect(pinOfComment([], placed)).toEqual({ key: 'screens/a.tsx:7:5', ids: ['e1'] })
  })
})
