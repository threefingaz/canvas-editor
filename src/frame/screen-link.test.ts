import { describe, expect, test } from 'vitest'
import { linkAt, linkTarget, screenHash, screenIdFromHash, type LinkNode } from './screen-link.ts'

const ids = ['onboarding/welcome', 'onboarding/workspace', 'home', 'onboarding/café']

// A plain element: its tag, its attributes and its parent.
function node(localName: string, attributes: Record<string, string>, parentElement: LinkNode | null = null): LinkNode {
  return {
    localName,
    getAttribute: (name) => (name in attributes ? attributes[name] : null),
    parentElement,
  }
}

describe('screenIdFromHash', () => {
  test('reads a plain id', () => {
    expect(screenIdFromHash('#/home')).toBe('home')
  })

  test('reads an id in a sub folder', () => {
    expect(screenIdFromHash('#/onboarding/welcome')).toBe('onboarding/welcome')
  })

  test('decodes an encoded character', () => {
    expect(screenIdFromHash('#/onboarding/caf%C3%A9')).toBe('onboarding/café')
    expect(screenIdFromHash('#/onboarding%2Fwelcome')).toBe('onboarding/welcome')
  })

  test('leaves out a slash at the end', () => {
    expect(screenIdFromHash('#/onboarding/welcome/')).toBe('onboarding/welcome')
    expect(screenIdFromHash('#/home//')).toBe('home')
  })

  test('leaves out an encoded slash at the end, as a plain one', () => {
    expect(screenIdFromHash('#/onboarding%2F')).toBe('onboarding')
    expect(screenIdFromHash('#/onboarding/welcome%2F/')).toBe('onboarding/welcome')
    expect(screenIdFromHash('#/%2F')).toBeNull()
  })

  test('keeps spaces: an id of spaces is an id, which no screen has', () => {
    expect(screenIdFromHash('#/%20')).toBe(' ')
    expect(linkTarget('#/%20', ids)).toEqual({ kind: 'unknown-screen', id: ' ' })
  })

  test('gives null for the forms of the index', () => {
    expect(screenIdFromHash('')).toBeNull()
    expect(screenIdFromHash('#')).toBeNull()
    expect(screenIdFromHash('#/')).toBeNull()
    expect(screenIdFromHash('#//')).toBeNull()
  })

  test('gives null for a hash that is not a screen address', () => {
    expect(screenIdFromHash('#top')).toBeNull()
    expect(screenIdFromHash('/home')).toBeNull()
  })

  test('gives the raw text for an escape that cannot be decoded', () => {
    expect(screenIdFromHash('#/onboarding/%E0%A4%A')).toBe('onboarding/%E0%A4%A')
    expect(screenIdFromHash('#/100%')).toBe('100%')
  })
})

describe('screenHash', () => {
  test('gives the address of a plain id', () => {
    expect(screenHash('home')).toBe('#/home')
  })

  test('keeps the slashes of an id in a sub folder', () => {
    expect(screenHash('onboarding/welcome')).toBe('#/onboarding/welcome')
  })

  test('encodes a character of a part, and screenIdFromHash gives the id back', () => {
    expect(screenHash('onboarding/café')).toBe('#/onboarding/caf%C3%A9')
    for (const id of ['onboarding/café', 'flow one/step #2', 'a/100%']) {
      expect(screenIdFromHash(screenHash(id))).toBe(id)
    }
  })
})

describe('linkTarget', () => {
  test('gives a screen of the list', () => {
    expect(linkTarget('#/onboarding/workspace', ids)).toEqual({ kind: 'screen', id: 'onboarding/workspace' })
    expect(linkTarget('#/onboarding/caf%C3%A9/', ids)).toEqual({ kind: 'screen', id: 'onboarding/café' })
  })

  test('gives an unknown screen for an id that is not in the list', () => {
    expect(linkTarget('#/onboarding/missing', ids)).toEqual({ kind: 'unknown-screen', id: 'onboarding/missing' })
    expect(linkTarget('#/onboarding/welcome', [])).toEqual({ kind: 'unknown-screen', id: 'onboarding/welcome' })
  })

  test('gives an unknown screen with the raw text for an escape that cannot be decoded', () => {
    expect(linkTarget('#/home%', ids)).toEqual({ kind: 'unknown-screen', id: 'home%' })
  })

  test('gives other for no address', () => {
    expect(linkTarget(null, ids)).toEqual({ kind: 'other' })
    expect(linkTarget('', ids)).toEqual({ kind: 'other' })
  })

  test('gives other for an address in the page', () => {
    expect(linkTarget('#', ids)).toEqual({ kind: 'other' })
    expect(linkTarget('#top', ids)).toEqual({ kind: 'other' })
  })

  test('gives other for the index', () => {
    expect(linkTarget('#/', ids)).toEqual({ kind: 'other' })
  })

  test('gives other for a web address and for mail', () => {
    expect(linkTarget('https://example.com/#/home', ids)).toEqual({ kind: 'other' })
    expect(linkTarget('mailto:team@example.com', ids)).toEqual({ kind: 'other' })
  })
})

describe('linkAt', () => {
  test('gives the target when the node is the link', () => {
    const link = node('a', { href: '#/home' })
    expect(linkAt(link, ids)).toEqual({ kind: 'screen', id: 'home' })
  })

  test('gives the target of the link of a child', () => {
    const link = node('a', { href: '#/onboarding/workspace', class: 'button' })
    const label = node('span', {}, link)
    const icon = node('path', {}, node('svg', {}, label))
    expect(linkAt(label, ids)).toEqual({ kind: 'screen', id: 'onboarding/workspace' })
    expect(linkAt(icon, ids)).toEqual({ kind: 'screen', id: 'onboarding/workspace' })
  })

  test('gives the nearest link when a library part draws a link inside a link', () => {
    const card = node('a', { href: '#/home' }, node('main', {}))
    const button = node('a', { href: '#/onboarding/missing' }, node('div', {}, card))
    const label = node('span', {}, button)
    expect(linkAt(label, ids)).toEqual({ kind: 'unknown-screen', id: 'onboarding/missing' })
  })

  test('gives other for a link that is not a screen address', () => {
    expect(linkAt(node('span', {}, node('a', { href: 'https://example.com' })), ids)).toEqual({ kind: 'other' })
  })

  test('passes over an element with an href that is not a link', () => {
    const link = node('a', { href: '#/home' })
    const use = node('use', { href: '#icon-arrow' }, node('svg', {}, link))
    expect(linkAt(use, ids)).toEqual({ kind: 'screen', id: 'home' })
  })

  test('passes over an `a` with no href', () => {
    const link = node('a', { href: '#/home' })
    const anchor = node('a', { id: 'top' }, link)
    expect(linkAt(anchor, ids)).toEqual({ kind: 'screen', id: 'home' })
  })

  test('gives null when no node up to the root is a link', () => {
    const root = node('html', {})
    const leaf = node('span', {}, node('div', {}, node('body', {}, root)))
    expect(linkAt(leaf, ids)).toBeNull()
  })

  test('gives null for no node', () => {
    expect(linkAt(null, ids)).toBeNull()
  })
})
