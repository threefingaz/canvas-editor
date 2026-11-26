import { describe, expect, test } from 'vitest'
import type { Site } from '../locate/fiber.ts'
import type { LinkNode } from '../../frame/screen-link.ts'
import { brokenLinks, crossingSites, innerLocs, placesOf } from './collect.ts'

function site(line: number, tag: string, origin: Site['origin'] = 'library'): Site {
  const file = 'screens/onboarding/welcome.tsx'
  return { loc: `${file}:${line}:5`, file, line, column: 5, tag, origin }
}

const stack = site(51, 'Stack')
const chip = site(53, 'Chip')
const feature = site(60, 'Feature', 'local')
const box = site(20, 'Box')

describe('innerLocs', () => {
  test('gives each node the location of its first site, the inner element', () => {
    const inner = innerLocs([
      { node: 'box', site: box },
      { node: 'box', site: feature },
      { node: 'chip-1', site: chip },
    ])
    expect([...inner]).toEqual([
      ['box', box.loc],
      ['chip-1', chip.loc],
    ])
  })
})

describe('placesOf', () => {
  test('one place for each location, with the first copy and the count of copies', () => {
    const places = placesOf(
      [
        { node: 'stack', site: stack },
        { node: 'chip-1', site: chip },
        { node: 'chip-2', site: chip },
        { node: 'chip-3', site: chip },
      ],
      () => false,
    )
    expect(places).toEqual([
      { node: 'stack', site: stack, copies: 1, inner: true },
      { node: 'chip-1', site: chip, copies: 3, inner: true },
    ])
  })

  test('the first visible copy is the node; a place with no visible copy is left out', () => {
    const places = placesOf(
      [
        { node: 'stack', site: stack },
        { node: 'chip-1', site: chip },
        { node: 'chip-2', site: chip },
      ],
      (node) => node === 'stack' || node === 'chip-1',
    )
    expect(places).toEqual([{ node: 'chip-2', site: chip, copies: 2, inner: true }])
  })

  test('of the elements of one node, only the inner one gives the rows', () => {
    // `sitesIn` gives the inner element of a node first.
    const places = placesOf(
      [
        { node: 'box', site: box },
        { node: 'box', site: feature },
      ],
      () => false,
    )
    expect(places).toEqual([
      { node: 'box', site: box, copies: 1, inner: true },
      { node: 'box', site: feature, copies: 1, inner: false },
    ])
  })
})

// A DOM element as `brokenLinks` reads it.
type FakeNode = LinkNode & { name: string; parentElement: FakeNode | null; removed?: true }

function node(name: string, parentElement: FakeNode | null = null, href: string | null = null): FakeNode {
  return {
    name,
    localName: href === null ? 'div' : 'a',
    parentElement,
    getAttribute: (attribute) => (attribute === 'href' ? href : null),
  }
}

describe('brokenLinks', () => {
  const ids = ['onboarding/welcome', 'onboarding/workspace']
  const button = site(70, 'Button')
  const card = site(40, 'Card')
  const local = site(30, 'Feature', 'local')

  test('a link to a screen of the list is not broken; a link to an unknown screen is, on its element', () => {
    const ok = node('ok', null, '#/onboarding/workspace')
    const wrong = node('wrong', null, '#/onboarding/nothing')
    const links = brokenLinks(
      [
        { node: ok, site: button },
        { node: wrong, site: site(72, 'Button') },
      ],
      [ok, wrong],
      ids,
      () => false,
    )
    expect([...links]).toEqual([[site(72, 'Button').loc, ['#/onboarding/nothing']]])
  })

  test('an address that is not a screen address is not broken', () => {
    const links = ['#/', '#top', 'https://example.com', 'mailto:team@example.com', '#'].map((href) =>
      node(href, null, href),
    )
    const sites = links.map((link, index) => ({ node: link, site: site(80 + index, 'Link') }))
    expect(brokenLinks(sites, links, ids, () => false).size).toBe(0)
  })

  test('a link inside a library part belongs to the nearest screen element above it', () => {
    const root = node('card')
    const inner = node('inner', root)
    const link = node('a', inner, '#/missing')
    const label = node('label', link)
    const links = brokenLinks([{ node: root, site: card }], [link], ids, () => false)
    expect([...links]).toEqual([[card.loc, ['#/missing']]])
    // The label of the link is not a link: only the nodes that the scan gives count.
    expect(brokenLinks([{ node: root, site: card }], [label], ids, () => false).size).toBe(0)
  })

  test('of the elements of one node, the inner one takes the link', () => {
    const link = node('a', null, '#/missing')
    const links = brokenLinks(
      [
        { node: link, site: button },
        { node: link, site: local },
      ],
      [link],
      ids,
      () => false,
    )
    expect([...links]).toEqual([[button.loc, ['#/missing']]])
  })

  test('the copies of a place give each address once', () => {
    const first = node('a1', null, '#/missing')
    const second = node('a2', null, '#/missing')
    const third = node('a3', null, '#/other%20missing')
    const links = brokenLinks(
      [
        { node: first, site: button },
        { node: second, site: button },
        { node: third, site: button },
      ],
      [first, second, third],
      ids,
      () => false,
    )
    expect([...links]).toEqual([[button.loc, ['#/missing', '#/other%20missing']]])
  })

  test('a hidden link and a link with no screen element are left out', () => {
    const hiddenLink = node('hidden', null, '#/missing')
    const loose = node('loose', node('body'), '#/missing')
    const links = brokenLinks([{ node: hiddenLink, site: button }], [hiddenLink, loose], ids, (n) => n === hiddenLink)
    expect(links.size).toBe(0)
  })

  test('a link inside a removed element is left out: the mark is on an element above the link', () => {
    // As `hiddenBy` reads the DOM: a node is hidden when it or a node above it
    // has the mark of a remove edit.
    const hidden = (n: FakeNode) => {
      for (let current: FakeNode | null = n; current; current = current.parentElement) if (current.removed) return true
      return false
    }
    const removedCard = { ...node('card'), removed: true as const }
    const inner = node('inner', removedCard)
    const link = node('a', inner, '#/missing')
    const keptCard = node('kept')
    const keptLink = node('a2', node('inner2', keptCard), '#/missing')
    const links = brokenLinks(
      [
        { node: removedCard, site: card },
        { node: link, site: button },
        { node: keptCard, site: site(90, 'Card') },
      ],
      [link, keptLink],
      ids,
      hidden,
    )
    expect([...links]).toEqual([[site(90, 'Card').loc, ['#/missing']]])
  })
})

describe('crossingSites', () => {
  test('each visible copy that goes over the right edge, also a later copy of a place', () => {
    const rects: Record<string, { right: number; width: number }> = {
      stack: { right: 390, width: 390 },
      'chip-1': { right: 100, width: 80 },
      'chip-2': { right: 420, width: 80 },
      'chip-3': { right: 500, width: 80 },
    }
    const sites = [
      { node: 'stack', site: stack },
      { node: 'chip-1', site: chip },
      { node: 'chip-2', site: chip },
      { node: 'chip-3', site: chip },
    ]
    expect(crossingSites(sites, (node) => node === 'chip-3', (node) => rects[node], 390, 0)).toEqual([
      { tag: 'Chip', file: 'screens/onboarding/welcome.tsx', line: 53, width: 80 },
    ])
    // Scrolled to the side: the right edge of a rectangle is in the view.
    expect(crossingSites(sites, () => false, (node) => rects[node], 390, 40).map((entry) => entry.line)).toEqual([51, 53, 53])
  })
})
