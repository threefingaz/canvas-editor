import { describe, expect, test } from 'vitest'
import { createLinkRectsStore, linkRectsOf, sameLinkRects } from './link-rects.ts'

const rect = (x: number, y = 0, width = 80, height = 30) => ({ x, y, width, height })

// A plain object in place of a link element.
function link(href: string | null, box = rect(0), extra: { isConnected?: boolean; hidden?: boolean } = {}) {
  return {
    isConnected: extra.isConnected ?? true,
    hidden: extra.hidden ?? false,
    getAttribute: (name: string) => (name === 'href' ? href : null),
    getBoundingClientRect: () => box,
  }
}

const hidden = (node: { hidden: boolean }) => node.hidden
const ids = ['a/two', 'a/three']

describe('linkRectsOf', () => {
  test('gives the rectangle of the first link to each screen', () => {
    const nodes = [link('#/a/two', rect(10)), link('#/a/three', rect(20)), link('#/a/two', rect(30))]
    expect(linkRectsOf(nodes, ids, hidden)).toEqual(
      new Map([
        ['a/two', rect(10)],
        ['a/three', rect(20)],
      ]),
    )
  })

  test('leaves out an address that is not a screen of the list', () => {
    const nodes = [link('#/a/none'), link('#top'), link('#/'), link(null), link('https://example.com/')]
    expect(linkRectsOf(nodes, ids, hidden).size).toBe(0)
  })

  test('takes the next link when the first one is hidden, has no size or is not in the document', () => {
    const nodes = [
      link('#/a/two', rect(10), { hidden: true }),
      link('#/a/two', rect(20, 0, 0, 0)),
      link('#/a/two', rect(30), { isConnected: false }),
      link('#/a/two', rect(40)),
    ]
    expect(linkRectsOf(nodes, ids, hidden)).toEqual(new Map([['a/two', rect(40)]]))
  })

  test('a link with no visible element has no rectangle', () => {
    expect(linkRectsOf([link('#/a/two', rect(10), { hidden: true })], ids, hidden).size).toBe(0)
  })
})

describe('the store of the link rectangles', () => {
  test('tells its listeners only about a change', () => {
    const store = createLinkRectsStore()
    let calls = 0
    store.subscribe(() => calls++)
    store.set('a/one', new Map([['a/two', rect(10)]]))
    const first = store.get()
    store.set('a/one', new Map([['a/two', rect(10)]]))
    expect(calls).toBe(1)
    expect(store.get()).toBe(first)
    store.set('a/one', new Map([['a/two', rect(11)]]))
    expect(calls).toBe(2)
    expect(store.get()).not.toBe(first)
    expect(store.get().get('a/one')?.get('a/two')).toEqual(rect(11))
    store.delete('a/one')
    store.delete('a/one')
    expect(calls).toBe(3)
    expect(store.get().size).toBe(0)
  })

  test('sameLinkRects compares the ids and the numbers', () => {
    expect(sameLinkRects(undefined, new Map())).toBe(false)
    expect(sameLinkRects(new Map(), new Map())).toBe(true)
    expect(sameLinkRects(new Map([['a', rect(1)]]), new Map([['b', rect(1)]]))).toBe(false)
  })
})
