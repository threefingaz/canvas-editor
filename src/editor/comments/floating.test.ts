import { describe, expect, test } from 'vitest'
import { noStrips } from '../canvas/viewport.ts'
import type { Item } from '../edits/model.ts'
import { loc, record } from '../locate/fiber-fixtures.ts'
import type { Fiber } from '../locate/fiber.ts'
import type { FrameDocument } from '../selection/pick.ts'
import { bubbleAfter, liveTarget, newBoxOf, type Bubble } from './bubble.ts'
import { nodeOf, panelPlace, targetSite } from './floating.ts'

const chipLoc = 'screens/a.tsx:12:9'
const screenId = 'onboarding/welcome'

function ChipRoot() {}

// A plain object in place of a DOM node of a frame document, with its record.
// `hiddenBy` names the edit ids in its `data-canvas-edit`: the preview hides
// it when a remove edit with one of them is open.
function chip(parent: Fiber, ownerDocument: unknown, hiddenBy: string | null = null) {
  const component = record(ChipRoot, loc(chipLoc, 'Chip', 'library'), parent)
  const host = record('div', null, component)
  const node = {
    tag: 'div',
    parentNode: null,
    isConnected: true,
    ownerDocument,
    closest: (selector: string) => (hiddenBy !== null && selector.includes(hiddenBy) ? node : null),
    __reactFiber$test: host,
  } as unknown as Element
  host.stateNode = node
  return node
}

// A frame document with its window and three copies of one place (a `map`);
// the first copy carries the id `e1` of a remove edit.
function frame() {
  const document = { defaultView: {} } as FrameDocument & { defaultView: object }
  const root = record(null, null, null)
  const nodes = [chip(root, document, 'e1'), chip(root, document), chip(root, document)]
  Object.assign(document, {
    elementFromPoint: () => null,
    body: { getElementsByTagName: () => nodes },
    getElementById: () => ({ hasChildNodes: () => true }),
  })
  return { document, nodes }
}

const removeFirst: Item = {
  edit: {
    id: 'e1',
    target: { file: 'screens/a.tsx', line: 12, column: 9, tag: 'Chip', origin: 'library', element: 'div', copies: 3, label: '' },
    width: 1440,
    change: { kind: 'remove' },
  },
}

describe('nodeOf', () => {
  const target = { screenId, loc: chipLoc }

  test('the place of the whole screen and no document give no node', () => {
    const { document } = frame()
    expect(nodeOf({ screenId, loc: null }, document, null, [])).toBeNull()
    expect(nodeOf(target, null, null, [])).toBeNull()
  })

  test('with no selection at the place, the first copy', () => {
    const { document, nodes } = frame()
    expect(nodeOf(target, document, null, [])).toBe(nodes[0])
  })

  test('the selected copy when the selection is at the place, also a copy other than the first', () => {
    const { document, nodes } = frame()
    expect(nodeOf(target, document, { screenId, loc: chipLoc, node: nodes[2] }, [])).toBe(nodes[2])
  })

  test('a selection at a different place or in a different screen gives the first copy', () => {
    const { document, nodes } = frame()
    expect(nodeOf(target, document, { screenId, loc: 'screens/a.tsx:3:1', node: nodes[2] }, [])).toBe(nodes[0])
    expect(nodeOf(target, document, { screenId: 'onboarding/workspace', loc: chipLoc, node: nodes[2] }, [])).toBe(nodes[0])
  })

  test('a selection in a document of the frame before a reload gives the copy of the current document', () => {
    const old = frame()
    const { document, nodes } = frame()
    expect(nodeOf(target, document, { screenId, loc: chipLoc, node: old.nodes[2] }, [])).toBe(nodes[0])
    // The old document has no window any more.
    const gone = { ...old.nodes[2], ownerDocument: { defaultView: null }, isConnected: true } as unknown as Element
    expect(nodeOf(target, document, { screenId, loc: chipLoc, node: gone }, [])).toBe(nodes[0])
  })

  test('a first copy that the preview hides gives the next copy', () => {
    const { document, nodes } = frame()
    expect(nodeOf(target, document, null, [removeFirst])).toBe(nodes[1])
  })
})

describe('targetSite of a detached panel', () => {
  test('a sibling that landed at the old place of a gone element is not taken', () => {
    // The agent removed the selected element at `chipLoc`; a Chip that was
    // below it is at that place now (the nodes of the frame).
    const { document, nodes } = frame()
    const open: Bubble = { kind: 'new', target: { screenId, loc: chipLoc } }
    const live = targetSite(liveTarget(open), document as unknown as Document, null, [])
    expect(live.node).toBe(nodes[0])
    const detached = bubbleAfter(open, { type: 'gone', screenId, loc: chipLoc }) as Exclude<Bubble, { kind: 'closed' }>
    const found = targetSite(liveTarget(detached), document as unknown as Document, null, [])
    expect(found).toEqual({ node: null, site: null })
    // The box keeps the draft with the warning, and Add (which needs a node
    // and a site) has no element to target.
    expect(newBoxOf(detached.target, null, found.site !== null, true)).toBe('draft')
    expect(newBoxOf(detached.target, null, found.site !== null, false)).toBe('no-site')
  })
})

describe('panelPlace', () => {
  const canvas = { width: 1000, height: 600 }
  const panel = { width: 200, height: 150 }
  const gap = 8

  test('at the right of the anchor, with its top at the top of the anchor', () => {
    expect(panelPlace({ x: 100, y: 100, width: 20, height: 20 }, panel, canvas, gap, noStrips)).toEqual({ x: 128, y: 100 })
  })

  test('with no room at the right, at the left of the anchor', () => {
    expect(panelPlace({ x: 900, y: 100, width: 20, height: 20 }, panel, canvas, gap, noStrips)).toEqual({ x: 692, y: 100 })
  })

  test('with room on neither side, at the right edge of the canvas', () => {
    expect(panelPlace({ x: 100, y: 100, width: 800, height: 20 }, panel, { width: 600, height: 600 }, gap, noStrips)).toEqual({
      x: 392,
      y: 100,
    })
  })

  test('an anchor near the bottom gives a panel that ends gap above the bottom edge', () => {
    expect(panelPlace({ x: 100, y: 550, width: 20, height: 20 }, panel, canvas, gap, noStrips)).toEqual({ x: 128, y: 442 })
  })

  test('an anchor near the top keeps the panel gap below the top edge', () => {
    expect(panelPlace({ x: 100, y: 2, width: 20, height: 20 }, panel, canvas, gap, noStrips)).toEqual({ x: 128, y: 8 })
  })

  test('an anchor out of the view gives a panel at the nearest edge, in the canvas', () => {
    expect(panelPlace({ x: -500, y: -300, width: 20, height: 20 }, panel, canvas, gap, noStrips)).toEqual({ x: 8, y: 8 })
    expect(panelPlace({ x: 2000, y: 1500, width: 20, height: 20 }, panel, canvas, gap, noStrips)).toEqual({ x: 792, y: 442 })
    expect(panelPlace({ x: 300, y: -300, width: 20, height: 20 }, panel, canvas, gap, noStrips)).toEqual({ x: 328, y: 8 })
  })

  test('the panel stays out of the strips of the notice and the toolbar', () => {
    const strips = { top: 48, bottom: 64 }
    // Near the bottom: it ends gap above the toolbar, 600 - 64 - 8 - 150.
    expect(panelPlace({ x: 100, y: 500, width: 20, height: 20 }, panel, canvas, gap, strips)).toEqual({ x: 128, y: 378 })
    // Near the top: gap below the notice.
    expect(panelPlace({ x: 100, y: 10, width: 20, height: 20 }, panel, canvas, gap, strips)).toEqual({ x: 128, y: 56 })
  })

  describe('with the element of the anchor', () => {
    // A wide element: its pin is at its top right corner, with no room at
    // the right of it and none at the left of the element.
    const element = { x: 60, y: 200, width: 500, height: 40 }
    const pin = { x: 550, y: 190, width: 20, height: 20 }
    const narrow = { width: 600, height: 600 }

    test('with room at the right, the element changes nothing', () => {
      const small = { x: 100, y: 100, width: 60, height: 20 }
      expect(panelPlace({ x: 150, y: 90, width: 20, height: 20 }, panel, canvas, gap, noStrips, small)).toEqual({ x: 178, y: 90 })
    })

    test('with no room at the right, at the left of the element, not of the anchor', () => {
      const wide = { x: 300, y: 100, width: 600, height: 20 }
      expect(panelPlace({ x: 890, y: 90, width: 20, height: 20 }, panel, canvas, gap, noStrips, wide)).toEqual({ x: 92, y: 90 })
    })

    test('with room on neither side, below the element, with its right edge at the right edge of the element', () => {
      expect(panelPlace(pin, panel, narrow, gap, noStrips, element)).toEqual({ x: 360, y: 248 })
    })

    test('with no room below, above the element', () => {
      const low = { ...element, y: 420 }
      expect(panelPlace({ ...pin, y: 410 }, panel, narrow, gap, noStrips, low)).toEqual({ x: 360, y: 262 })
    })

    test('with room on no side, at the right edge of the canvas, as with no element', () => {
      const tall = { x: 60, y: 100, width: 500, height: 400 }
      expect(panelPlace({ ...pin, y: 90 }, panel, narrow, gap, noStrips, tall)).toEqual({ x: 392, y: 90 })
    })

    test('below the element, the panel stays out of the toolbar', () => {
      // 248 + 150 is above 600 - 300 - 8: no room below, thus above.
      expect(panelPlace(pin, panel, narrow, gap, { top: 0, bottom: 300 }, element)).toEqual({ x: 360, y: 42 })
    })
  })

  test('a canvas that is smaller than the panel gives the top left corner, gap from the edges', () => {
    expect(panelPlace({ x: 50, y: 50, width: 20, height: 20 }, panel, { width: 100, height: 100 }, gap, noStrips)).toEqual({
      x: 8,
      y: 8,
    })
  })
})
