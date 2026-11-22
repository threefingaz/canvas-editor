import { describe, expect, test } from 'vitest'
import type { Target } from '../../requests/format.ts'
import { loc, record } from '../locate/fiber-fixtures.ts'
import type { Fiber, Site } from '../locate/fiber.ts'
import { selectionTarget } from './target.ts'

// Plain objects in place of DOM nodes: a node has the key of its record, as
// React gives it, its tag, its text nodes and its document.
type PlainNode = {
  tagName: string
  nodeType: number
  childNodes: { nodeType: number; nodeValue: string }[]
  parentNode: null
  ownerDocument: object
  __reactFiber$test: Fiber
}

const buttonLoc = 'screens/a.tsx:12:9'

function Button() {}

const site: Site = {
  loc: buttonLoc,
  file: 'screens/a.tsx',
  line: 12,
  column: 9,
  tag: 'Button',
  origin: 'library',
}

// A screen with `count` copies of one `Button` (a `map`), each a `button`
// node with one text node.
function screen(texts: string[]) {
  const nodes: PlainNode[] = []
  const document = { body: { getElementsByTagName: () => nodes } }
  const root = record(null, null, null)
  for (const text of texts) {
    const component = record(Button, loc(buttonLoc, 'Button', 'library'), root)
    const fiber = record('button', null, component)
    const node: PlainNode = {
      tagName: 'BUTTON',
      nodeType: 1,
      childNodes: [{ nodeType: 3, nodeValue: text }],
      parentNode: null,
      ownerDocument: document,
      __reactFiber$test: fiber,
    }
    fiber.stateNode = node
    nodes.push(node)
  }
  return nodes as unknown as Element[]
}

describe('selectionTarget', () => {
  test('one copy gives the place, the tag of the node and the text', () => {
    const [node] = screen(['Continue'])
    const expected: Target = {
      file: 'screens/a.tsx',
      line: 12,
      column: 9,
      tag: 'Button',
      origin: 'library',
      element: 'button',
      copies: 1,
      label: 'Continue',
    }
    expect(selectionTarget({ node, loc: buttonLoc }, site)).toEqual(expected)
  })

  test('more than one copy gives their count and the text of the selected copy', () => {
    const nodes = screen(['One', 'Two', 'Three'])
    expect(selectionTarget({ node: nodes[1], loc: buttonLoc }, site)).toEqual({
      file: 'screens/a.tsx',
      line: 12,
      column: 9,
      tag: 'Button',
      origin: 'library',
      element: 'button',
      copies: 3,
      label: 'Two',
    })
  })

  test('a long label is cut to 80 characters, and white space is joined', () => {
    const long = `Plan   your\nteam ${'week '.repeat(30)}`
    const [node] = screen([long])
    const target = selectionTarget({ node, loc: buttonLoc }, site)
    expect(target.label).toBe(`Plan your team ${'week '.repeat(30)}`.slice(0, 80).trimEnd())
    expect(target.label.length).toBeLessThanOrEqual(80)
  })

  test('a node that the document does not list still counts as one copy', () => {
    const [node] = screen(['Continue'])
    const lone = { ...(node as unknown as PlainNode), ownerDocument: { body: null } } as unknown as Element
    expect(selectionTarget({ node: lone, loc: buttonLoc }, site).copies).toBe(1)
  })
})
