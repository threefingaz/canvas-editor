import { describe, expect, test } from 'vitest'
import type { Site } from '../locate/fiber.ts'
import { brokenLinks, placesOf, type LinkElement } from './collect.ts'

function site(line: number, tag: string, origin: Site['origin'] = 'library'): Site {
  const file = 'screens/onboarding/welcome.tsx'
  return { loc: `${file}:${line}:5`, file, line, column: 5, tag, origin }
}

const stack = site(51, 'Stack')
const chip = site(53, 'Chip')
const feature = site(60, 'Feature', 'local')
const box = site(20, 'Box')

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
type FakeNode = LinkElement & { name: string }

function node(name: string, parentElement: FakeNode | null = null, href: string | null = null): FakeNode {
  return { name, parentElement, getAttribute: (attribute) => (attribute === 'href' ? href : null) }
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
})
