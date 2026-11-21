import { cloneElement, createElement, type ReactElement } from 'react'
import { describe, expect, test } from 'vitest'
import { loc, record } from './fiber-fixtures.ts'
import { breadcrumb, elementOf, elementsAt, fiberName, fiberOf, hostNode, locationPrefix, parseLoc, parseLocation, screenElement, siteOf, type Fiber } from './fiber.ts'

function Button() {}
function Card() {
  return null
}
function Stack() {}

describe('parseLocation', () => {
  test('reads the file, the line and the column', () => {
    expect(parseLocation('screens/onboarding/welcome.tsx:12:7')).toEqual({
      loc: 'screens/onboarding/welcome.tsx:12:7',
      file: 'screens/onboarding/welcome.tsx',
      line: 12,
      column: 7,
    })
  })

  test('keeps a colon in the file path', () => {
    expect(parseLocation('C:/work/screens/a.tsx:3:5')).toMatchObject({ file: 'C:/work/screens/a.tsx', line: 3, column: 5 })
  })

  test('gives null for a text that is not a location', () => {
    expect(parseLocation('screens/a.tsx')).toBeNull()
    expect(parseLocation('screens/a.tsx:3')).toBeNull()
    expect(parseLocation(':3:5')).toBeNull()
    expect(parseLocation('screens/a.tsx:x:5')).toBeNull()
    expect(parseLocation('screens/a.tsx:3:5 Stack library')).toBeNull()
  })
})

describe('parseLoc', () => {
  test('reads the location, the tag and the origin from the end', () => {
    expect(parseLoc('screens/onboarding/welcome.tsx:12:7 Stack library')).toEqual({
      loc: 'screens/onboarding/welcome.tsx:12:7',
      file: 'screens/onboarding/welcome.tsx',
      line: 12,
      column: 7,
      tag: 'Stack',
      origin: 'library',
    })
    expect(parseLoc('screens/a.tsx:3:5 Card.Header local')).toMatchObject({ tag: 'Card.Header', origin: 'local' })
    expect(parseLoc('screens/a.tsx:3:5 div host')).toMatchObject({ tag: 'div', origin: 'host' })
  })

  test('keeps a space or a colon in the file path', () => {
    expect(parseLoc('screens/my flow/a b.tsx:3:5 Stack library')).toMatchObject({
      loc: 'screens/my flow/a b.tsx:3:5',
      file: 'screens/my flow/a b.tsx',
      line: 3,
      column: 5,
      tag: 'Stack',
    })
    expect(parseLoc('C:/work/screens/a.tsx:3:5 div host')).toMatchObject({ file: 'C:/work/screens/a.tsx', line: 3, column: 5 })
  })

  test('gives null for a text that is not a location prop value', () => {
    expect(parseLoc('screens/a.tsx:3:5')).toBeNull()
    expect(parseLoc('screens/a.tsx:3:5 Stack')).toBeNull()
    expect(parseLoc('screens/a.tsx:3:5 Stack other')).toBeNull()
    expect(parseLoc('screens/a.tsx:3 Stack library')).toBeNull()
    expect(parseLoc('screens/a.tsx Stack library')).toBeNull()
    expect(parseLoc('')).toBeNull()
  })
})

describe('fiberName', () => {
  test('a host element gives its tag', () => {
    expect(fiberName(record('div'))).toBe('div')
  })

  test('a function gives its display name, else its name', () => {
    expect(fiberName(record(Button))).toBe('Button')
    const named = Object.assign(function Inner() {}, { displayName: 'Outer' })
    expect(fiberName(record(named))).toBe('Outer')
  })

  test('a forwardRef type gives the name of its render function', () => {
    const forwardRef = { $$typeof: Symbol.for('react.forward_ref'), render: function Field() {} }
    expect(fiberName(record(forwardRef))).toBe('Field')
    expect(fiberName(record({ ...forwardRef, displayName: 'MuiField' }))).toBe('MuiField')
  })

  test('a memo type gives the name of the inner type, also a memo of a forwardRef', () => {
    expect(fiberName(record({ $$typeof: Symbol.for('react.memo'), type: Card }))).toBe('Card')
    const inner = { $$typeof: Symbol.for('react.forward_ref'), render: function Row() {} }
    expect(fiberName(record({ $$typeof: Symbol.for('react.memo'), type: inner }))).toBe('Row')
  })

  test('a type with no name gives Anonymous', () => {
    expect(fiberName(record(() => {}))).toBe('Anonymous')
    expect(fiberName(record(null))).toBe('Anonymous')
  })
})

describe('fiberOf', () => {
  test('reads the React record from the key of the node', () => {
    const fiber = record('div')
    const node = { ['__reactFiber$abc123']: fiber, __reactProps$abc123: {} }
    expect(fiberOf(node)).toBe(fiber)
  })

  test('goes up to the parent node when the node has no record', () => {
    const fiber = record('div')
    const parent = { ['__reactFiber$x']: fiber, parentNode: null }
    expect(fiberOf({ parentNode: parent })).toBe(fiber)
  })

  test('takes the other copy of the record when its props are the props that React set last', () => {
    const props = { className: 'new' }
    const old = record('div', { className: 'old' })
    const current = record('div', props)
    old.alternate = current
    current.alternate = old
    const node = (fiber: Fiber, nodeProps: object): object => ({ __reactFiber$k: fiber, __reactProps$k: nodeProps })
    expect(fiberOf(node(old, props))).toBe(current)
    expect(fiberOf(node(current, props))).toBe(current)
    expect(fiberOf(node(old, { className: 'other' }))).toBe(old)
  })

  test('gives null for a node with no React record', () => {
    expect(fiberOf({ parentNode: { parentNode: null } })).toBeNull()
    expect(fiberOf(null)).toBeNull()
  })
})

describe('screenElement', () => {
  test('gives the nearest record with a location', () => {
    const root = record('div', loc('screens/a.tsx:1:1'))
    const span = record('span', { children: 'Hi' }, root)
    expect(screenElement(span)).toBe(root)
    expect(screenElement(root)).toBe(root)
  })

  test('gives the outer record when a component passes its location on', () => {
    const stack = record(Stack, loc('screens/a.tsx:2:3'))
    const stackDiv = record('div', loc('screens/a.tsx:2:3'), stack)
    const button = record(Button, loc('screens/a.tsx:4:5'), stackDiv)
    const provider = record({ $$typeof: Symbol.for('react.context') }, { value: 1 }, button)
    const root = record(function ButtonRoot() {}, loc('screens/a.tsx:4:5'), provider)
    const host = record('button', loc('screens/a.tsx:4:5'), root)
    const label = record('span', { className: 'label' }, host)
    expect(screenElement(label)).toBe(button)
    expect(screenElement(host)).toBe(button)
  })

  test('gives null when no record up to the root has a location', () => {
    const root = record('div')
    const span = record('span', null, root)
    expect(screenElement(span)).toBeNull()
    expect(screenElement(null)).toBeNull()
  })

  test('ignores a location that is not a string', () => {
    const root = record('div', { [`${locationPrefix}1-1`]: 12 })
    expect(screenElement(root)).toBeNull()
  })

  test('gives the own element of a child that a wrapper clones with its own props', () => {
    // `<Fade><Card>…</Card></Fade>`: a wrapper that clones its child with its
    // other props (as the transitions of the library do), thus Card carries
    // both locations.
    function Fade({ children, ...rest }: { children: ReactElement }) {
      return cloneElement(children, rest)
    }
    const fadeProps = { ...loc('screens/a.tsx:2:3', 'Fade'), children: createElement(Card, loc('screens/a.tsx:3:5', 'Card')) }
    const cardProps = Fade(fadeProps).props as Record<string, unknown>
    expect(cardProps).toEqual({ ...loc('screens/a.tsx:3:5', 'Card'), ...loc('screens/a.tsx:2:3', 'Fade') })

    const fade = record(Fade, fadeProps)
    const transition = record(function Transition() {}, loc('screens/a.tsx:2:3', 'Fade'), fade)
    const card = record(Card, cardProps, transition)
    const paper = record('div', cardProps, card)
    const text = record('span', null, paper)
    expect(screenElement(text)).toBe(card)
    expect(screenElement(transition)).toBe(fade)
    expect(breadcrumb(text)).toEqual([fade])
    expect(siteOf(card)).toMatchObject({ loc: 'screens/a.tsx:3:5', tag: 'Card' })
    expect(siteOf(fade)).toMatchObject({ loc: 'screens/a.tsx:2:3', tag: 'Fade' })
    expect(siteOf(paper)).toBeNull()
  })

  test('gives the own element of a child that gets the props of a component of the screen', () => {
    // `function Row(props) { return <Box {...props} /> }` and `<Row />`.
    const row = record(function Row() {}, loc('screens/a.tsx:9:5'))
    const box = record(function Box() {}, { ...loc('screens/a.tsx:9:5'), ...loc('screens/a.tsx:3:10') }, row)
    const div = record('div', { ...loc('screens/a.tsx:9:5'), ...loc('screens/a.tsx:3:10') }, box)
    expect(screenElement(div)).toBe(box)
    expect(breadcrumb(div)).toEqual([row])
  })
})

describe('breadcrumb', () => {
  test('gives the parents with different locations, inner first', () => {
    const screen = record(function Welcome() {})
    const stack = record(Stack, loc('screens/a.tsx:2:3'), screen)
    const stackDiv = record('div', loc('screens/a.tsx:2:3'), stack)
    const card = record(Card, loc('screens/a.tsx:3:5'), stackDiv)
    const paper = record('div', loc('screens/a.tsx:3:5'), card)
    const button = record(Button, loc('screens/a.tsx:4:7'), paper)
    const host = record('button', loc('screens/a.tsx:4:7'), button)
    expect(breadcrumb(host)).toEqual([card, stack])
    expect(breadcrumb(button)).toEqual([card, stack])
    expect(breadcrumb(stack)).toEqual([])
  })

  test('gives an empty list for a record with no location', () => {
    expect(breadcrumb(record('div'))).toEqual([])
  })
})

describe('siteOf', () => {
  test('gives the location, the tag name and the origin from the prop', () => {
    expect(siteOf(record(Button, loc('screens/a.tsx:4:7', 'Button', 'library')))).toEqual({
      loc: 'screens/a.tsx:4:7',
      file: 'screens/a.tsx',
      line: 4,
      column: 7,
      tag: 'Button',
      origin: 'library',
    })
  })

  test('gives the tag name of the screen file, not the name of the component of the record', () => {
    const stack = record(function StackRoot() {}, loc('screens/a.tsx:2:3', 'Stack', 'library'))
    expect(fiberName(stack)).toBe('StackRoot')
    expect(siteOf(stack)).toMatchObject({ tag: 'Stack', origin: 'library' })
  })

  test('a prop value that cannot be read does not count', () => {
    expect(siteOf(record(Button, { [`${locationPrefix}4-7`]: 'screens/a.tsx:4:7' }))).toBeNull()
  })

  test('gives null for a record with no location', () => {
    expect(siteOf(record('div'))).toBeNull()
  })
})

describe('hostNode', () => {
  test('a host record gives its own node', () => {
    const node = { tagName: 'DIV' }
    expect(hostNode(record('div', null, null, node))).toBe(node)
  })

  test('a component gives the first node of its children, depth first', () => {
    const button = record(Button)
    const inner = record(function Inner() {}, null, button)
    const first = { tagName: 'BUTTON' }
    record('button', null, inner, first)
    record('span', null, button, { tagName: 'SPAN' })
    expect(hostNode(button)).toBe(first)
  })

  test('skips a component with no node and goes on to its sibling', () => {
    const list = record(function List() {})
    record(function Empty() {}, null, list)
    const second = { tagName: 'LI' }
    record('li', null, list, second)
    expect(hostNode(list)).toBe(second)
  })

  test('does not leave the record for its siblings', () => {
    const parent = record('div', null, null, { tagName: 'DIV' })
    const empty = record(function Empty() {}, null, parent)
    record('span', null, parent, { tagName: 'SPAN' })
    expect(hostNode(empty)).toBeNull()
  })
})

describe('elementsAt and elementOf', () => {
  // `Row` is a component of the screen file that renders no node of its own:
  // its first node is the node of the inner `Card`. The `Stack` around it has
  // its own `div`.
  function tree() {
    const stack = record(Stack, loc('screens/a.tsx:2:3'))
    const stackNode = { tagName: 'DIV' }
    const stackDiv = record('div', null, stack, stackNode)
    const row = record(function Row() {}, loc('screens/a.tsx:9:5'), stackDiv)
    const card = record(Card, loc('screens/a.tsx:30:7'), row)
    const cardNode = { tagName: 'DIV', parentNode: stackNode }
    const cardDiv = record('div', null, card, cardNode)
    Object.assign(cardNode, { __reactFiber$t: cardDiv })
    Object.assign(stackNode, { __reactFiber$t: stackDiv })
    return { stack, row, card, stackNode: stackNode as unknown as Element, cardNode: cardNode as unknown as Element }
  }

  test('gives each screen element whose first node is the node, inner first', () => {
    const { stack, row, card, stackNode, cardNode } = tree()
    expect(elementsAt(cardNode)).toEqual([card, row])
    expect(elementsAt(stackNode)).toEqual([stack])
  })

  test('compares the location part, not the full prop value', () => {
    const stack = record(Stack, loc('file:3:5', 'Stack', 'library'))
    const node = { tagName: 'DIV' }
    const div = record('div', null, stack, node)
    Object.assign(node, { __reactFiber$t: div })
    expect(stack.memoizedProps).toEqual({ [`${locationPrefix}3-5`]: 'file:3:5 Stack library' })
    expect(elementOf(node as unknown as Element, 'file:3:5')).toBe(stack)
    expect(elementOf(node as unknown as Element, 'file:3:5 Stack library')).toBeNull()
  })

  test('a parent with the same location and a different tag is the same element', () => {
    const outer = record(Stack, loc('screens/a.tsx:2:3', 'Stack', 'library'))
    const inner = record(function StackRoot() {}, loc('screens/a.tsx:2:3', 'StackRoot', 'library'), outer)
    expect(screenElement(inner)).toBe(outer)
  })

  test('gives the element with the location, also an outer one', () => {
    const { row, card, cardNode } = tree()
    expect(elementOf(cardNode, 'screens/a.tsx:9:5')).toBe(row)
    expect(elementOf(cardNode, 'screens/a.tsx:30:7')).toBe(card)
    expect(elementOf(cardNode, 'screens/a.tsx:2:3')).toBeNull()
  })
})
