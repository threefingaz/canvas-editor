import { describe, expect, test } from 'vitest'
import { loc, record } from '../locate/fiber-fixtures.ts'
import { fiberOf, screenElement, type Fiber } from '../locate/fiber.ts'
import {
  findAgain,
  hiddenBy,
  hitAt,
  nodesAt,
  nodesByLoc,
  pickAt,
  pickElement,
  refind,
  screenRendered,
  siblingsOf,
  sitesIn,
  type FrameDocument,
} from './pick.ts'

// The preview hides no node.
const nothing = () => false

// Plain objects in place of DOM nodes. A node has the key of its record, as
// React gives it, and its parent node.
function host(tag: string, parent: Fiber, parentNode: object | null): { fiber: Fiber; node: Element } {
  const fiber = record(tag, null, parent)
  const node = { tag, parentNode, __reactFiber$test: fiber } as unknown as Element
  fiber.stateNode = node
  return { fiber, node }
}

// The names of the components of the records are different from the tags
// that the screen file writes: the name of an element comes from its tag.
function StackRoot() {}
function ChipRoot() {}
function Row() {}
function CardRoot() {}

const stackLoc = 'screens/a.tsx:10:5'
const chipLoc = 'screens/a.tsx:12:9'

// A Stack with three Chips from one line (a `map`); each Chip is a `div` with a `span`.
function screen() {
  const root = record(null, null, null)
  const stack = record(StackRoot, loc(stackLoc, 'Stack', 'library'), root)
  const stackDiv = host('div', stack, null)
  const chips = [0, 1, 2].map(() => {
    const chip = record(ChipRoot, loc(chipLoc, 'Chip', 'library'), stackDiv.fiber)
    const div = host('div', chip, stackDiv.node)
    const span = host('span', div.fiber, div.node)
    return { div: div.node, span: span.node }
  })
  // A node that React did not make, inside the second chip.
  const extra = { tag: 'i', parentNode: chips[1].span } as unknown as Element
  const nodes = [stackDiv.node, ...chips.flatMap((chip) => [chip.div, chip.span]), extra]
  return { nodes, stackDiv: stackDiv.node, chips, extra }
}

const rowLoc = 'screens/b.tsx:20:7'
const cardLoc = 'screens/b.tsx:8:10'

// Two `Row`s from one line (a `map`). `Row` is a component of the screen file
// that renders no node of its own: it renders a `Card` written on a different
// line, and the `Card` is a `div` with a `span`.
function rows() {
  const root = record(null, null, null)
  const list = host('section', root, null)
  const items = [0, 1].map(() => {
    const row = record(Row, loc(rowLoc, 'Row', 'local'), list.fiber)
    const card = record(CardRoot, loc(cardLoc, 'Card', 'library'), row)
    const div = host('div', card, list.node)
    const span = host('span', div.fiber, div.node)
    return { row, div: div.node, span: span.node }
  })
  const nodes = [list.node, ...items.flatMap((item) => [item.div, item.span])]
  return { nodes, items }
}

function frameDocument(nodes: Element[], atPoint: Element | null, rendered = true): FrameDocument {
  return {
    elementFromPoint: () => atPoint,
    body: { getElementsByTagName: () => nodes },
    getElementById: () => ({ hasChildNodes: () => rendered }),
  }
}

describe('sitesIn', () => {
  const place = (result: ReturnType<typeof sitesIn>) =>
    result.map(({ node, site }) => [(node as unknown as { tag: string }).tag, site.loc, site.tag, site.origin])

  test('gives each copy of each place with its first node, and skips nodes with no own element', () => {
    const { nodes, chips, stackDiv } = screen()
    const result = sitesIn(frameDocument(nodes, null))
    expect(result.map((entry) => entry.node)).toEqual([stackDiv, chips[0].div, chips[1].div, chips[2].div])
    expect(place(result)).toEqual([
      ['div', stackLoc, 'Stack', 'library'],
      ['div', chipLoc, 'Chip', 'library'],
      ['div', chipLoc, 'Chip', 'library'],
      ['div', chipLoc, 'Chip', 'library'],
    ])
  })

  test('gives the elements that share a node, inner first', () => {
    const { nodes, items } = rows()
    const result = sitesIn(frameDocument(nodes, null))
    expect(result.map((entry) => entry.node)).toEqual([items[0].div, items[0].div, items[1].div, items[1].div])
    expect(result.map((entry) => entry.site.loc)).toEqual([cardLoc, rowLoc, cardLoc, rowLoc])
  })

  test('a document with no body gives nothing', () => {
    expect(sitesIn({ ...frameDocument([], null), body: null })).toEqual([])
  })
})

describe('pickElement', () => {
  test('a parent element of the breadcrumb gives its first node and its index', () => {
    const { nodes, chips, stackDiv } = screen()
    const stack = screenElement(fiberOf(chips[2].div))!.return!.return!
    expect(pickElement(frameDocument(nodes, null), stack)).toEqual({ node: stackDiv, loc: stackLoc, index: 0, name: 'Stack' })
  })

  test('an element that shares its node with an inner element gives its own location and index', () => {
    const { nodes, items } = rows()
    expect(pickElement(frameDocument(nodes, null), items[1].row)).toEqual({ node: items[1].div, loc: rowLoc, index: 1, name: 'Row' })
  })

  test('a record with no location, or none at all, gives null', () => {
    const { nodes, chips } = screen()
    expect(pickElement(frameDocument(nodes, null), fiberOf(chips[0].span))).toBeNull()
    expect(pickElement(frameDocument(nodes, null), null)).toBeNull()
  })

  test('an element whose node is not among the nodes of the document gives null, not the first index', () => {
    const { nodes, chips } = screen()
    const chip = screenElement(fiberOf(chips[1].div))
    const others = nodes.filter((node) => node !== chips[1].div)
    expect(pickElement(frameDocument(others, null), chip)).toBeNull()
  })
})

describe('pickAt', () => {
  test('an inner node gives the screen element, its first node and its index', () => {
    const { nodes, chips } = screen()
    const picked = pickAt(frameDocument(nodes, chips[1].span), { x: 5, y: 5 }, nothing)
    expect(picked).toEqual({ node: chips[1].div, loc: chipLoc, index: 1, name: 'Chip' })
  })

  test('a node that React did not make gives the element of its parent node', () => {
    const { nodes, chips, extra } = screen()
    expect(pickAt(frameDocument(nodes, extra), { x: 5, y: 5 }, nothing)?.node).toBe(chips[1].div)
  })

  test('no node at the point gives null', () => {
    const { nodes } = screen()
    expect(pickAt(frameDocument(nodes, null), { x: 5, y: 5 }, nothing)).toBeNull()
  })

  test('a node outside the screen elements gives null', () => {
    const { nodes } = screen()
    const outside = { tag: 'body', parentNode: null } as unknown as Element
    expect(pickAt(frameDocument(nodes, outside), { x: 5, y: 5 }, nothing)).toBeNull()
  })
})

describe('hitAt', () => {
  test('gives the screen element at the point with no index', () => {
    const { nodes, chips } = screen()
    expect(hitAt(frameDocument(nodes, chips[1].span), { x: 5, y: 5 }, nothing)).toEqual({ node: chips[1].div, loc: chipLoc, name: 'Chip' })
    expect(hitAt(frameDocument(nodes, null), { x: 5, y: 5 }, nothing)).toBeNull()
  })
})

describe('a node that the preview hides', () => {
  test('pickAt and hitAt give null for an element whose first node is hidden', () => {
    const { nodes, chips } = screen()
    const hidden = (node: Element) => node === chips[1].div
    expect(pickAt(frameDocument(nodes, chips[1].span), { x: 5, y: 5 }, hidden)).toBeNull()
    expect(hitAt(frameDocument(nodes, chips[1].span), { x: 5, y: 5 }, hidden)).toBeNull()
    expect(pickAt(frameDocument(nodes, chips[0].span), { x: 5, y: 5 }, hidden)?.node).toBe(chips[0].div)
  })

  test('hiddenBy: the node or one of its parents matches the selector', () => {
    const inside = { closest: (selector: string) => (selector === '[data-canvas-edit~="e1"]' ? {} : null) }
    const outside = { closest: () => null }
    expect(hiddenBy('[data-canvas-edit~="e1"]')(inside)).toBe(true)
    expect(hiddenBy('[data-canvas-edit~="e1"]')(outside)).toBe(false)
  })

  test('hiddenBy with no selector hides nothing', () => {
    expect(hiddenBy(null)({ closest: () => ({}) })).toBe(false)
  })
})

describe('findAgain', () => {
  test('finds the element with the same location and index in a new document', () => {
    const before = screen()
    const picked = pickAt(frameDocument(before.nodes, before.chips[2].span), { x: 5, y: 5 }, nothing)!
    const after = screen()
    expect(findAgain(frameDocument(after.nodes, null), picked.loc, picked.index)).toEqual({
      node: after.chips[2].div,
      loc: chipLoc,
      index: 2,
      name: 'Chip',
    })
  })

  test('counts the first node of each element with the location, in document order', () => {
    const { nodes, chips, stackDiv } = screen()
    const document = frameDocument(nodes, null)
    expect([0, 1, 2].map((index) => findAgain(document, chipLoc, index)?.node)).toEqual(chips.map((chip) => chip.div))
    expect(findAgain(document, stackLoc, 0)?.node).toBe(stackDiv)
    expect(findAgain(document, stackLoc, 1)).toBeNull()
  })

  test('finds an element that shares its node with an inner element', () => {
    const { nodes, items } = rows()
    const document = frameDocument(nodes, null)
    expect(findAgain(document, rowLoc, 1)).toEqual({ node: items[1].div, loc: rowLoc, index: 1, name: 'Row' })
    expect(findAgain(document, cardLoc, 1)).toEqual({ node: items[1].div, loc: cardLoc, index: 1, name: 'Card' })
  })

  test('gives null when the element is gone', () => {
    const { nodes } = screen()
    expect(findAgain(frameDocument(nodes, null), chipLoc, 3)).toBeNull()
    expect(findAgain(frameDocument(nodes, null), 'screens/a.tsx:99:1', 0)).toBeNull()
  })
})

describe('nodesAt', () => {
  test('gives the first node of each copy of a place, in document order', () => {
    const { nodes, chips, stackDiv } = screen()
    const document = frameDocument(nodes, null)
    expect(nodesAt(document, chipLoc)).toEqual(chips.map((chip) => chip.div))
    expect(nodesAt(document, stackLoc)).toEqual([stackDiv])
  })

  test('gives the shared node of an element that renders no node of its own', () => {
    const { nodes, items } = rows()
    const document = frameDocument(nodes, null)
    expect(nodesAt(document, rowLoc)).toEqual(items.map((item) => item.div))
    expect(nodesAt(document, cardLoc)).toEqual(items.map((item) => item.div))
  })

  test('gives no node for a place that draws nothing, or a document with no body', () => {
    const { nodes } = screen()
    expect(nodesAt(frameDocument(nodes, null), 'screens/a.tsx:99:1')).toEqual([])
    expect(nodesAt({ ...frameDocument(nodes, null), body: null }, chipLoc)).toEqual([])
  })
})

describe('nodesByLoc', () => {
  test('gives the nodes of each place in one walk, as nodesAt gives them', () => {
    const one = screen()
    const document = frameDocument(one.nodes, null)
    const map = nodesByLoc(document)
    expect([...map.keys()]).toEqual([stackLoc, chipLoc])
    expect(map.get(chipLoc)).toEqual(nodesAt(document, chipLoc))
    expect(map.get(stackLoc)).toEqual(nodesAt(document, stackLoc))
    const two = rows()
    const shared = frameDocument(two.nodes, null)
    expect(nodesByLoc(shared).get(rowLoc)).toEqual(nodesAt(shared, rowLoc))
    expect(nodesByLoc(shared).get(cardLoc)).toEqual(nodesAt(shared, cardLoc))
  })
})

describe('refind', () => {
  const ownNode = (ownerDocument: unknown, isConnected: boolean) => ({ ownerDocument, isConnected })

  test('keeps a node that is still in the current document', () => {
    const { nodes } = screen()
    const document = frameDocument(nodes, null)
    expect(refind({ node: ownNode(document, true), loc: chipLoc, index: 0 }, document)).toEqual({ action: 'keep' })
  })

  test('waits while the new document has no screen yet', () => {
    const document = frameDocument([], null, false)
    expect(refind({ node: ownNode({}, true), loc: chipLoc, index: 0 }, document)).toEqual({ action: 'wait' })
  })

  test('selects the element again in a new document, or in the same document when the node is out', () => {
    const { nodes, chips } = screen()
    const document = frameDocument(nodes, null)
    const expected = { action: 'select', picked: { node: chips[1].div, loc: chipLoc, index: 1, name: 'Chip' } }
    expect(refind({ node: ownNode({}, true), loc: chipLoc, index: 1 }, document)).toEqual(expected)
    expect(refind({ node: ownNode(document, false), loc: chipLoc, index: 1 }, document)).toEqual(expected)
  })

  test('clears when the element is gone', () => {
    const { nodes } = screen()
    expect(refind({ node: ownNode({}, true), loc: chipLoc, index: 3 }, frameDocument(nodes, null))).toEqual({ action: 'clear' })
  })
})

describe('screenRendered', () => {
  test('is true when the root of the frame has content', () => {
    expect(screenRendered(frameDocument([], null, true))).toBe(true)
  })

  test('is false while the screen is not rendered yet', () => {
    expect(screenRendered(frameDocument([], null, false))).toBe(false)
  })
})

describe('siblingsOf', () => {
  // A DOM node with its element children and its parent element.
  type Node = { tag: string; parentNode: Node | null; parentElement: Node | null; children: Node[] }

  function element(tag: string, fiber: Fiber, parent: Node | null): Node {
    const node: Node = { tag, parentNode: parent, parentElement: parent, children: [] }
    Object.assign(node, { __reactFiber$test: fiber })
    fiber.stateNode = node
    parent?.children.push(node)
    return node
  }

  // A located element that renders a host node of the tag.
  function placed(location: string, tag: string, parentFiber: Fiber, parentNode: Node | null) {
    const fiber = record(ChipRoot, loc(location, 'Typography', 'library'), parentFiber)
    return { fiber, node: element(tag, record(tag, null, fiber), parentNode) }
  }

  const parentLoc = 'screens/c.tsx:5:3'
  const firstLoc = 'screens/c.tsx:6:5'
  const secondLoc = 'screens/c.tsx:7:5'
  const thirdLoc = 'screens/c.tsx:8:5'

  // A Stack with three sibling elements, each from its own line.
  function stack() {
    const root = record(null, null, null)
    const parent = placed(parentLoc, 'div', root, null)
    const children = [firstLoc, secondLoc, thirdLoc].map((location) => placed(location, 'p', parent.fiber.child!, parent.node))
    return { parent: parent.node, children: children.map((child) => child.node), fibers: children.map((child) => child.fiber) }
  }

  const display = (value: string) => () => value
  const node = (value: Node) => value as unknown as Element

  test('gives the position, the count and the container of the parent', () => {
    const { children } = stack()
    expect(siblingsOf(node(children[1]), secondLoc, 1, display('flex'))).toEqual({
      position: 1,
      count: 3,
      container: 'flex',
      movable: true,
    })
    expect(siblingsOf(node(children[0]), firstLoc, 1, display('inline-grid'))?.container).toBe('grid')
  })

  test('a parent that is not flex or grid has no container, and the move is still possible', () => {
    const { children } = stack()
    expect(siblingsOf(node(children[2]), thirdLoc, 1, display('block'))).toEqual({
      position: 2,
      count: 3,
      container: null,
      movable: true,
    })
  })

  test('reads the display of the parent node', () => {
    const { parent, children } = stack()
    const seen: unknown[] = []
    siblingsOf(node(children[0]), firstLoc, 1, (target) => {
      seen.push(target)
      return 'flex'
    })
    expect(seen).toEqual([parent])
  })

  test('no move for a place that draws more than one copy', () => {
    const { chips, stackDiv } = screen()
    Object.assign(stackDiv, { children: chips.map((chip) => chip.div) })
    for (const chip of chips) Object.assign(chip.div, { parentElement: stackDiv })
    expect(siblingsOf(chips[0].div, chipLoc, 3, display('flex'))?.movable).toBe(false)
    // A list from one line is not a list of different elements, even with one copy counted.
    expect(siblingsOf(chips[0].div, chipLoc, 1, display('flex'))?.movable).toBe(false)
  })

  test('no move when a child node is not the first node of a screen element', () => {
    const { parent, children } = stack()
    element('span', record('span', null, null), parent)
    expect(siblingsOf(node(children[0]), firstLoc, 1, display('flex'))).toMatchObject({ count: 4, movable: false })
  })

  test('no move when a child has a different parent in the code', () => {
    const { parent, children } = stack()
    // An element of a different place in the code whose node is a child of the same parent node.
    const other = record(null, null, null)
    const outer = record(ChipRoot, loc('screens/c.tsx:20:1', 'Box', 'library'), other)
    placed('screens/c.tsx:21:3', 'p', outer, parent)
    expect(siblingsOf(node(children[0]), firstLoc, 1, display('flex'))?.movable).toBe(false)
  })

  test('no move for an inner element that shares its node with an outer element', () => {
    const { parent, fibers } = stack()
    // A wrapper on line 9 whose child element (line 30) renders the node.
    const wrapper = record(Row, loc('screens/c.tsx:9:5', 'Row', 'local'), fibers[0].return)
    const inner = placed('screens/c.tsx:30:3', 'p', wrapper, parent)
    expect(siblingsOf(node(inner.node), 'screens/c.tsx:9:5', 1, display('flex'))).toMatchObject({
      position: 3,
      count: 4,
      movable: true,
    })
    expect(siblingsOf(node(inner.node), 'screens/c.tsx:30:3', 1, display('flex'))?.movable).toBe(false)
  })

  test('no move for an only child', () => {
    const root = record(null, null, null)
    const parent = placed(parentLoc, 'div', root, null)
    const child = placed(firstLoc, 'p', parent.fiber.child!, parent.node)
    expect(siblingsOf(node(child.node), firstLoc, 1, display('flex'))).toEqual({
      position: 0,
      count: 1,
      container: 'flex',
      movable: false,
    })
  })

  test('null for a node with no parent element', () => {
    const root = record(null, null, null)
    const alone = placed(parentLoc, 'div', root, null)
    expect(siblingsOf(node(alone.node), parentLoc, 1, display('flex'))).toBeNull()
  })
})
