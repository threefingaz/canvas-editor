import { describe, expect, test } from 'vitest'
import type { Change, Edit, OrderChange, Target } from '../../requests/format.ts'
import type { Item } from '../edits/model.ts'
import {
  createFirstValues,
  marks,
  orderOf,
  ownTextNode,
  previewAttribute,
  textOf,
  textOps,
  writePreview,
  type ElementLike,
  type TextLike,
} from './apply.ts'
import { editAttribute } from './css.ts'

const target: Target = {
  file: 'screens/onboarding/welcome.tsx',
  line: 12,
  column: 7,
  tag: 'Typography',
  origin: 'library',
  element: 'h1',
  copies: 1,
  label: 'Welcome',
}

const chips: Target = { ...target, line: 30, column: 9, tag: 'Chip', element: 'div', copies: 2, label: 'Tag' }

function edit(id: string, change: Change, at: Target = target): Edit {
  return { id, target: at, width: 390, change }
}

const style: Change = {
  kind: 'style',
  properties: ['padding-top'],
  before: { value: '8px', observed: true },
  after: { value: '16px', token: { id: 'spacing.2', name: 'spacing.2', code: 2 } },
}

// Plain objects in place of DOM nodes: an element with its child nodes.
type Plain = ElementLike & { name: string }
const text = (value: string) => ({ nodeType: 3, nodeValue: value })
const tag = () => ({ nodeType: 1, nodeValue: null })
const element = (name: string, ...childNodes: ElementLike['childNodes'][number][]): Plain => ({ name, childNodes })

const heading = element('h1', text('Welcome'))
const chipNodes = [element('div', text('Tag')), element('div', text('Tag'))]

function nodesOf(at: Target): Plain[] {
  if (at.line === target.line) return [heading]
  if (at.line === chips.line) return chipNodes
  return []
}

describe('marks', () => {
  test('gives each node of a target the ids of its edits, in the sequence of the list', () => {
    const items: Item[] = [
      { edit: edit('e1', style) },
      { edit: edit('e2', { kind: 'remove' }, chips) },
      { edit: edit('e3', { kind: 'text', before: 'Welcome', after: 'Hello' }) },
    ]
    const result = marks(items, nodesOf)
    expect([...result.entries()]).toEqual([
      [heading, 'e1 e3'],
      [chipNodes[0], 'e2'],
      [chipNodes[1], 'e2'],
    ])
  })

  test('an item with a reply or with stale gets no mark', () => {
    const items: Item[] = [
      { edit: { ...edit('e1', style), reply: { status: 'conflict', text: 'The value changed' } } },
      { edit: edit('e2', { kind: 'remove' }), stale: true },
    ]
    expect(marks(items, nodesOf).size).toBe(0)
  })

  test('a target that draws no node gives no mark', () => {
    const items: Item[] = [{ edit: edit('e1', style, { ...target, line: 99 }) }]
    expect(marks(items, nodesOf).size).toBe(0)
  })
})

describe('orderOf', () => {
  const order = (before: number, after: number, of: number): OrderChange => ({
    kind: 'order',
    before,
    after,
    of,
    previewed: true,
  })

  test('a move earlier gives each child its new position', () => {
    expect(orderOf(['a', 'b', 'c', 'd'], order(2, 0, 4))).toEqual([1, 2, 0, 3])
  })

  test('a move later gives each child its new position', () => {
    expect(orderOf(['a', 'b', 'c', 'd'], order(0, 3, 4))).toEqual([3, 0, 1, 2])
    expect(orderOf(['a', 'b', 'c'], order(1, 2, 3))).toEqual([0, 2, 1])
  })

  test('no move keeps the sequence', () => {
    expect(orderOf(['a', 'b'], order(1, 1, 2))).toEqual([0, 1])
  })

  test('a count of children that is different from the count of the edit gives null', () => {
    expect(orderOf(['a', 'b', 'c'], order(0, 1, 4))).toBeNull()
  })
})

describe('ownTextNode', () => {
  test('is the one text node of the element', () => {
    const node = text('Get started')
    expect(ownTextNode(element('button', node, tag()))).toBe(node)
  })

  test('is null for no text node or more than one', () => {
    expect(ownTextNode(element('div', tag()))).toBeNull()
    expect(ownTextNode(element('p', text('a'), tag(), text('c')))).toBeNull()
  })
})

describe('textOps', () => {
  test('gives the text node of each copy of the target with the new text', () => {
    const items: Item[] = [{ edit: edit('e1', { kind: 'text', before: 'Tag', after: 'Label' }, chips) }]
    expect(textOps(items, nodesOf)).toEqual([
      { element: chipNodes[0], node: chipNodes[0].childNodes[0], id: 'e1', text: 'Label' },
      { element: chipNodes[1], node: chipNodes[1].childNodes[0], id: 'e1', text: 'Label' },
    ])
  })

  test('skips an element with no text node or more than one', () => {
    const empty = element('div', tag())
    const mixed = element('p', text('a'), tag(), text('c'))
    const items: Item[] = [{ edit: edit('e1', { kind: 'text', before: 'a', after: 'b' }) }]
    expect(textOps(items, () => [empty, mixed])).toEqual([])
  })

  test('skips the other edit kinds and an item with a reply or with stale', () => {
    const change: Change = { kind: 'text', before: 'Welcome', after: 'Hello' }
    const items: Item[] = [
      { edit: edit('e1', style) },
      { edit: { ...edit('e2', change), reply: { status: 'unclear', text: 'Which heading?' } } },
      { edit: edit('e3', change), stale: true },
    ]
    expect(textOps(items, nodesOf)).toEqual([])
  })
})

describe('createFirstValues', () => {
  const a = { name: 'a' }
  const b = { name: 'b' }

  test('keeps the first value of a node and an edit id', () => {
    const values = createFirstValues<object, string>()
    values.keep(a, 'e1', () => 'Welcome')
    values.keep(a, 'e1', () => 'Hello')
    values.keep(b, 'e1', () => 'Tag')
    expect(values.release(() => false)).toEqual([
      { node: a, id: 'e1', value: 'Welcome' },
      { node: b, id: 'e1', value: 'Tag' },
    ])
  })

  test('release gives and forgets only the values that are no longer active', () => {
    const values = createFirstValues<object, string>()
    values.keep(a, 'e1', () => '1')
    values.keep(b, 'e2', () => '2')
    values.keep(b, 'e1', () => '3')
    expect(values.release((_, id) => id === 'e1')).toEqual([{ node: b, id: 'e2', value: '2' }])
    expect(values.release((node) => node === b)).toEqual([{ node: a, id: 'e1', value: '1' }])
    // A forgotten value is read again.
    values.keep(a, 'e1', () => 'new')
    expect(values.release(() => false)).toEqual([
      { node: b, id: 'e1', value: '2' },
      { node: a, id: 'e1', value: 'new' },
    ])
  })

  test('a second edit on a node keeps the value before the first change, not the value of the first edit', () => {
    const values = createFirstValues<object, string>()
    values.keep(a, 'e1', () => 'code')
    // The preview of e1 wrote its value; e2 would read it.
    values.keep(a, 'e2', () => 'value of e1')
    expect(values.release(() => false)).toEqual([
      { node: a, id: 'e1', value: 'code' },
      { node: a, id: 'e2', value: 'code' },
    ])
  })

  test('first gives the kept value of a node for any edit, until it is released', () => {
    const values = createFirstValues<object, string>()
    expect(values.first(a)).toBeUndefined()
    values.keep(a, 'e1', () => 'Welcome')
    expect(values.first(a)).toBe('Welcome')
    expect(values.first(b)).toBeUndefined()
    values.release(() => false)
    expect(values.first(a)).toBeUndefined()
  })
})

describe('textOf', () => {
  const node = (nodeType: number, nodeValue: string | null, ...childNodes: TextLike[]): TextLike => ({
    nodeType,
    nodeValue,
    childNodes,
  })
  const plain = (value: string) => node(3, value)
  const el = (...childNodes: TextLike[]) => node(1, null, ...childNodes)
  const none = () => undefined

  test('gives the text of all text nodes, as textContent does, with no comments', () => {
    const tree = el(plain('Hello '), el(plain('big')), node(8, 'a comment'), el(), plain(' world'))
    expect(textOf(tree, none)).toBe('Hello big world')
    expect(textOf(plain('Tag'), none)).toBe('Tag')
  })

  test('gives the first text of an element whose text the preview changed, also in a child', () => {
    const title = el(plain('Plan the week'))
    const tree = el(title, el(plain(' now')))
    const first = (element: TextLike) => (element === title ? 'Welcome' : undefined)
    expect(textOf(title, first)).toBe('Welcome')
    expect(textOf(tree, first)).toBe('Welcome now')
  })

  test('an element with a kept text and no single text node of its own gives its nodes', () => {
    const mixed = el(plain('A'), plain('B'))
    expect(textOf(mixed, () => 'kept')).toBe('AB')
  })
})

// A small document of plain objects, with only the members that the preview
// reads and writes.
class FakeStyle {
  readonly values = new Map<string, { value: string; priority: string }>()
  getPropertyValue(name: string) {
    return this.values.get(name)?.value ?? ''
  }
  getPropertyPriority(name: string) {
    return this.values.get(name)?.priority ?? ''
  }
  setProperty(name: string, value: string, priority = '') {
    this.values.set(name, { value, priority })
  }
  removeProperty(name: string) {
    this.values.delete(name)
  }
}

type FakeText = { nodeType: 3; nodeValue: string }

class FakeElement {
  readonly nodeType = 1
  readonly nodeValue = null
  readonly attributes = new Map<string, string>()
  readonly style = new FakeStyle()
  parentElement: FakeElement | null = null
  childNodes: (FakeElement | FakeText)[] = []
  textContent = ''
  connected = true
  readonly tagName: string
  constructor(tagName: string, ...children: (FakeElement | FakeText)[]) {
    this.tagName = tagName
    for (const child of children) this.appendChild(child)
  }
  get children(): FakeElement[] {
    return this.childNodes.filter((child): child is FakeElement => child instanceof FakeElement)
  }
  get isConnected() {
    return this.connected
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
  removeAttribute(name: string) {
    this.attributes.delete(name)
  }
  appendChild(child: FakeElement | FakeText) {
    this.childNodes.push(child)
    if (child instanceof FakeElement) child.parentElement = this
    return child
  }
  remove() {
    if (!this.parentElement) return
    this.parentElement.childNodes = this.parentElement.childNodes.filter((child) => child !== this)
    this.parentElement = null
  }
  // Only the selector `tag[attribute]`, on the children.
  querySelector(selector: string) {
    const [, name, attribute] = /^(\w+)\[([\w-]+)\]$/.exec(selector) ?? []
    return this.children.find((child) => child.tagName === name && child.attributes.has(attribute)) ?? null
  }
  all(): FakeElement[] {
    return this.children.flatMap((child) => [child, ...child.all()])
  }
}

const fakeText = (nodeValue: string): FakeText => ({ nodeType: 3, nodeValue })

function fakeDocument(body: FakeElement) {
  const head = new FakeElement('head')
  return {
    head,
    body,
    createElement: (name: string) => new FakeElement(name),
    // Only the selector `[attribute]`.
    querySelectorAll: (selector: string) => {
      const attribute = selector.slice(1, -1)
      return [...head.all(), ...body.all()].filter((element) => element.attributes.has(attribute))
    },
  }
}

describe('writePreview', () => {
  const order = (before: number, after: number): Change => ({ kind: 'order', before, after, of: 3, previewed: true })
  const at = (line: number): Target => ({ ...target, line })

  function setup() {
    const title = new FakeElement('h1', fakeText('Welcome'))
    const a = new FakeElement('div')
    const b = new FakeElement('div')
    const c = new FakeElement('div')
    // A child with an inline order of the code.
    c.style.setProperty('order', '5')
    const row = new FakeElement('div', a, b, c)
    const body = new FakeElement('body', title, row)
    const document = fakeDocument(body)
    const byLine = new Map<number, FakeElement[]>([
      [12, [title]],
      [20, [a]],
      [21, [b]],
      [22, [c]],
    ])
    const nodesOf = (place: Target) => (byLine.get(place.line) ?? []) as unknown as Element[]
    const write = (items: Item[]) => writePreview(document as unknown as Document, items, [], nodesOf)
    const orders = () => [a, b, c].map((child) => `${child.style.getPropertyValue('order')}${child.style.getPropertyPriority('order') ? '!' : ''}`)
    return { title, a, b, c, row, document, write, orders }
  }

  test('writes the marks, the rules and the text, and a second application writes nothing', () => {
    const { title, document, write } = setup()
    const items: Item[] = [
      { edit: edit('e1', { kind: 'style', properties: ['color'], before: { value: 'red' }, after: { value: 'blue' } }) },
      { edit: edit('e2', { kind: 'text', before: 'Welcome', after: 'Hello' }) },
    ]
    expect(write(items)).toEqual({ changed: true, problems: [] })
    expect(title.getAttribute(editAttribute)).toBe('e1 e2')
    const styleElement = document.head.querySelector(`style[${previewAttribute}]`)
    expect(styleElement?.textContent).toBe('[data-canvas-edit~="e1"] { color: blue !important }')
    expect((title.childNodes[0] as FakeText).nodeValue).toBe('Hello')
    expect(write(items)).toEqual({ changed: false, problems: [] })
  })

  test('updates the style element when the rules change, and removes it with no rule', () => {
    const { document, write } = setup()
    const color = (value: string): Item => ({
      edit: edit('e1', { kind: 'style', properties: ['color'], before: { value: 'red' }, after: { value } }),
    })
    write([color('blue')])
    const styleElement = document.head.querySelector(`style[${previewAttribute}]`)
    expect(write([color('green')]).changed).toBe(true)
    expect(document.head.querySelector(`style[${previewAttribute}]`)).toBe(styleElement)
    expect(styleElement?.textContent).toBe('[data-canvas-edit~="e1"] { color: green !important }')
    expect(write([]).changed).toBe(true)
    expect(document.head.querySelector(`style[${previewAttribute}]`)).toBeNull()
  })

  test('a discard puts back the text, the order and takes out the marks', () => {
    const { title, a, write, orders } = setup()
    write([
      { edit: edit('e1', { kind: 'text', before: 'Welcome', after: 'Hello' }) },
      { edit: edit('e2', order(0, 2), at(20)) },
    ])
    expect(orders()).toEqual(['2!', '0!', '1!'])
    expect(write([])).toEqual({ changed: true, problems: [] })
    expect((title.childNodes[0] as FakeText).nodeValue).toBe('Welcome')
    expect(title.getAttribute(editAttribute)).toBeNull()
    expect(a.getAttribute(editAttribute)).toBeNull()
    expect(orders()).toEqual(['', '', '5'])
    expect(write([]).changed).toBe(false)
  })

  test('two order edits in one parent: the discard of both puts back the order of the code', () => {
    const { write, orders } = setup()
    const first: Item = { edit: edit('e1', order(0, 2), at(20)) }
    const second: Item = { edit: edit('e2', order(1, 0), at(21)) }
    write([first, second])
    // The later edit wins for each child.
    expect(orders()).toEqual(['1!', '0!', '2!'])
    write([])
    expect(orders()).toEqual(['', '', '5'])

    // The second edit comes in a later application than the first.
    write([first])
    write([first, second])
    write([second])
    expect(orders()).toEqual(['1!', '0!', '2!'])
    write([])
    expect(orders()).toEqual(['', '', '5'])
  })

  test('an order edit whose node is not at its position, or with a wrong count, writes no order', () => {
    const { write, orders } = setup()
    write([{ edit: edit('e1', order(1, 2), at(20)) }])
    expect(orders()).toEqual(['', '', '5'])
    write([{ edit: edit('e1', { kind: 'order', before: 0, after: 1, of: 4, previewed: true }, at(20)) }])
    expect(orders()).toEqual(['', '', '5'])
  })

  test('the preview of a list with comments is the preview of the list with no comments', () => {
    const others: Item[] = [
      { edit: edit('e1', { kind: 'style', properties: ['color'], before: { value: 'red' }, after: { value: 'blue' } }) },
      { edit: edit('e2', { kind: 'text', before: 'Welcome', after: 'Hello' }) },
      { edit: edit('e3', order(0, 2), at(20)) },
    ]
    const comments: Item[] = [
      { edit: edit('c1', { kind: 'comment', text: 'Make this a table.' }) },
      { edit: { id: 'c2', target: null, width: 390, change: { kind: 'comment', text: 'Add an empty state.' } } },
      { edit: edit('c3', { kind: 'comment', text: 'Move this up.' }, at(21)) },
    ]
    const state = ({ title, a, b, document, orders }: ReturnType<typeof setup>) => ({
      marks: [title, a, b].map((node) => node.getAttribute(editAttribute)),
      rules: document.head.querySelector(`style[${previewAttribute}]`)?.textContent,
      text: (title.childNodes[0] as FakeText).nodeValue,
      orders: orders(),
    })
    const plain = setup()
    const mixed = setup()
    expect(mixed.write([comments[0], ...others, comments[1], comments[2]])).toEqual(plain.write(others))
    expect(state(mixed)).toEqual(state(plain))
    expect(mixed.b.getAttribute(editAttribute)).toBeNull()
    // Only comments: nothing to write.
    expect(setup().write(comments)).toEqual({ changed: false, problems: [] })
  })

  test('an order edit with no preview writes no order', () => {
    const { write, orders } = setup()
    write([{ edit: edit('e1', { kind: 'order', before: 0, after: 1, of: 3, previewed: false }, at(20)) }])
    expect(orders()).toEqual(['', '', '5'])
  })
})
