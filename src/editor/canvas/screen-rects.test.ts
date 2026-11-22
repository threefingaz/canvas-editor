import { describe, expect, test } from 'vitest'
import type { Change, Target } from '../../requests/format.ts'
import type { Item, PlacedEdit } from '../edits/model.ts'
import { loc, record } from '../locate/fiber-fixtures.ts'
import type { Fiber } from '../locate/fiber.ts'
import {
  createScreenRectsStore,
  currentRects,
  measured,
  rectsOf,
  rectsResult,
  targetNodes,
  type MeasureDocument,
} from './screen-rects.ts'
import type { Rect } from './viewport.ts'

const cardLoc = 'screens/a.tsx:10:5'
const chipLoc = 'screens/a.tsx:12:9'

function target(location: string): Target {
  const [file, line, column] = location.split(':')
  return { file, line: Number(line), column: Number(column), tag: 'Card', origin: 'library', element: 'div', copies: 1, label: '' }
}

function item(id: string, location: string | null, change: Change, extra: Partial<Item> = {}): Item {
  return { edit: { id, target: location === null ? null : target(location), width: 1440, change }, ...extra }
}

const comment = (id: string, location: string | null): Item => item(id, location, { kind: 'comment', text: 'Task' })
const remove = (id: string, location: string): Item => item(id, location, { kind: 'remove' })

// A plain object in place of a DOM node, with its record, its rectangle and
// whether it is still in the document. `closest` matches nothing.
function node(type: unknown, props: Record<string, unknown>, parent: Fiber, rect: Rect, isConnected = true) {
  const component = record(type, props, parent)
  const host = record('div', null, component)
  const element = {
    tag: 'div',
    parentNode: null,
    isConnected,
    closest: () => null,
    getBoundingClientRect: () => rect,
    __reactFiber$test: host,
  } as unknown as Element
  host.stateNode = element
  return element
}

function CardRoot() {}
function ChipRoot() {}

const cardRect = { x: 10, y: 20, width: 300, height: 100 }

// A Card and two Chips from one line (a `map`).
function screen() {
  const root = record(null, null, null)
  const card = node(CardRoot, loc(cardLoc, 'Card', 'library'), root, cardRect)
  const chips = [0, 1].map((index) =>
    node(ChipRoot, loc(chipLoc, 'Chip', 'library'), root, { x: 10 + index * 50, y: 200, width: 40, height: 20 }),
  )
  return { nodes: [card, ...chips], card, chips }
}

function frameDocument(nodes: Element[], options: { rendered?: boolean; window?: boolean } = {}): MeasureDocument {
  return {
    elementFromPoint: () => null,
    body: { getElementsByTagName: () => nodes },
    getElementById: () => ({ hasChildNodes: () => options.rendered ?? true }),
    defaultView: options.window === false ? null : {},
  }
}

const nothing = () => false

describe('measured', () => {
  test('a comment on an element and an edit with a preview get a mark', () => {
    expect(measured(comment('e1', cardLoc))).toBe(true)
    expect(measured(remove('e2', cardLoc))).toBe(true)
  })

  test('a comment on the screen, an options item, a stale edit and an edit with a reply get none', () => {
    expect(measured(comment('e1', null))).toBe(false)
    expect(measured(item('e2', cardLoc, { kind: 'options', count: 3, note: '' }))).toBe(false)
    expect(measured({ ...remove('e3', cardLoc), stale: true })).toBe(false)
    const replied = remove('e4', cardLoc)
    expect(measured({ edit: { ...replied.edit, reply: { status: 'unclear', text: 'Which one?' } } })).toBe(false)
  })
})

describe('targetNodes', () => {
  test('only the first copy of a place is taken, once for each place', () => {
    const { nodes, card, chips } = screen()
    const items = [comment('e1', chipLoc), comment('e2', cardLoc), remove('e3', chipLoc)]
    const result = targetNodes(frameDocument(nodes), items, measured)
    expect([...(result ?? [])]).toEqual([
      [chipLoc, chips[0]],
      [cardLoc, card],
    ])
  })

  test('an item that `watches` does not take, and a place that draws nothing, are left out', () => {
    const { nodes } = screen()
    const items = [comment('e1', null), comment('e2', 'screens/a.tsx:99:1'), item('e3', cardLoc, { kind: 'options', count: 2, note: '' })]
    expect(targetNodes(frameDocument(nodes), items, measured)).toEqual(new Map())
  })

  test('null while the screen is not rendered or the document has no window', () => {
    const { nodes } = screen()
    const items = [comment('e1', cardLoc)]
    expect(targetNodes(frameDocument(nodes, { rendered: false }), items, measured)).toBeNull()
    expect(targetNodes(frameDocument(nodes, { window: false }), items, measured)).toBeNull()
  })
})

describe('rectsOf', () => {
  test('the rectangle of each node by its place', () => {
    const { card, chips } = screen()
    const nodes = new Map([
      [cardLoc, card],
      [chipLoc, chips[0]],
    ])
    expect(rectsOf(nodes, nothing)).toEqual(
      new Map([
        [cardLoc, cardRect],
        [chipLoc, { x: 10, y: 200, width: 40, height: 20 }],
      ]),
    )
  })

  test('a node with no size, a node that the preview hides, and a node out of the document count as not found', () => {
    const root = record(null, null, null)
    const empty = node(CardRoot, loc(cardLoc), root, { x: 5, y: 5, width: 0, height: 0 })
    const out = node(CardRoot, loc(chipLoc), root, cardRect, false)
    const hiddenNode = node(CardRoot, loc('screens/a.tsx:14:3'), root, cardRect)
    const nodes = new Map([
      [cardLoc, empty],
      [chipLoc, out],
      ['screens/a.tsx:14:3', hiddenNode],
    ])
    expect(rectsOf(nodes, (candidate) => candidate === hiddenNode)).toEqual(new Map())
  })

  test('a node with a width or a height only is found', () => {
    const root = record(null, null, null)
    const line = node(CardRoot, loc(cardLoc), root, { x: 0, y: 4, width: 200, height: 0 })
    expect(rectsOf(new Map([[cardLoc, line]]), nothing).get(cardLoc)).toEqual({ x: 0, y: 4, width: 200, height: 0 })
  })
})

describe('rectsResult', () => {
  const items = [comment('e1', cardLoc), comment('e2', chipLoc)]
  const isComment = (entry: Item) => entry.edit.change.kind === 'comment'
  const place = (rect: Rect) => ({ ...rect, x: rect.x + 1000 })
  // The ids with the rectangle of each.
  const derive = (list: readonly Item[], rectOf: (edit: PlacedEdit) => Rect | null) =>
    list.flatMap((entry) => (entry.edit.target ? [[entry.edit.id, rectOf(entry.edit as PlacedEdit)]] : []))
  const empty: unknown[] = []
  const known = new Map([[cardLoc, cardRect]])

  test('off, or with no item that it watches, gives `empty` before each other check', () => {
    expect(rectsResult({ enabled: false, items, watches: isComment, error: true, measured: null }, place, derive, empty)).toBe(empty)
    const removes = [remove('e3', cardLoc)]
    expect(rectsResult({ enabled: true, items: removes, watches: isComment, error: true, measured: null }, place, derive, empty)).toBe(
      empty,
    )
  })

  test('a screen file that cannot be read gives no rectangle for any edit, with no measure', () => {
    expect(rectsResult({ enabled: true, items, watches: isComment, error: true, measured: null }, place, derive, empty)).toEqual([
      ['e1', null],
      ['e2', null],
    ])
  })

  test('with only comments on the whole screen, `derive` with no measure: the measure writes no entry for them', () => {
    const onScreen = [comment('e4', null), comment('e5', null)]
    const ids = (list: readonly Item[]) => list.map((entry) => entry.edit.id)
    expect(measured(onScreen[0])).toBe(false)
    expect(rectsResult({ enabled: true, items: onScreen, watches: isComment, error: false, measured: null }, place, ids, [])).toEqual([
      'e4',
      'e5',
    ])
    // An `options` item and an edit with a reply have no measure either.
    const replied = remove('e7', cardLoc)
    const mixed = [
      comment('e4', null),
      item('e6', null, { kind: 'options', count: 3, note: '' }),
      { edit: { ...replied.edit, reply: { status: 'unclear' as const, text: 'Which one?' } } },
    ]
    expect(rectsResult({ enabled: true, items: mixed, watches: isComment, error: false, measured: null }, place, ids, [])).toEqual([
      'e4',
      'e6',
      'e7',
    ])
    // Off still gives `empty`.
    expect(rectsResult({ enabled: false, items: onScreen, watches: isComment, error: false, measured: null }, place, ids, [])).toEqual(
      [],
    )
  })

  test('a comment on an element with one on the screen waits for the measure', () => {
    const both = [comment('e1', cardLoc), comment('e4', null)]
    expect(rectsResult({ enabled: true, items: both, watches: isComment, error: false, measured: null }, place, derive, empty)).toBeNull()
  })

  test('null while the rectangles are not known', () => {
    expect(rectsResult({ enabled: true, items, watches: isComment, error: false, measured: null }, place, derive, empty)).toBeNull()
  })

  test('the measured rectangle in the coordinates of the caller; a place with none gives null', () => {
    expect(rectsResult({ enabled: true, items, watches: isComment, error: false, measured: known }, place, derive, empty)).toEqual([
      ['e1', { ...cardRect, x: 1010 }],
      ['e2', null],
    ])
  })
})

describe('currentRects', () => {
  const document = {} as Document
  const items: Item[] = [comment('e1', cardLoc)]
  const rects = new Map([[cardLoc, cardRect]])

  test('the rectangles of a measure of this document and this list', () => {
    expect(currentRects({ document, items, rects }, document, items)).toBe(rects)
  })

  test('null for no measure, a measure of an older list, or of a different document', () => {
    expect(currentRects(undefined, document, items)).toBeNull()
    expect(currentRects({ document, items: [...items], rects }, document, items)).toBeNull()
    expect(currentRects({ document: {} as Document, items, rects }, document, items)).toBeNull()
  })

  test('a measure of a screen that is not rendered yet gives null', () => {
    expect(currentRects({ document, items, rects: null }, document, items)).toBeNull()
  })
})

describe('createScreenRectsStore', () => {
  test('a write and a delete notify; a delete of no entry does not', () => {
    const store = createScreenRectsStore()
    let calls = 0
    store.subscribe(() => calls++)
    const entry = { document: {} as Document, items: [], rects: null }
    store.set('a', entry)
    expect(store.get('a')).toBe(entry)
    expect(calls).toBe(1)
    store.delete('a')
    expect(store.get('a')).toBeUndefined()
    expect(calls).toBe(2)
    store.delete('a')
    expect(calls).toBe(2)
  })
})
