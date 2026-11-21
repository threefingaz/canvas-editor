import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { changesPage, hashOf, indexTitle, routeOf, titleOf, unknownTitle } from './route.ts'
import { screenEntry } from './screen-fixtures.ts'

const screens = [screenEntry('home'), screenEntry('onboarding/welcome'), screenEntry('onboarding/workspace')]

describe('routeOf', () => {
  test('gives the index for the forms of the index', () => {
    for (const hash of ['', '#', '#/', '#//']) {
      expect(routeOf(hash, screens)).toEqual({ kind: 'index' })
    }
  })

  test('gives the index for a hash that is not a screen address, the hash of a site that opens there', () => {
    expect(routeOf('#top', screens)).toEqual({ kind: 'index' })
  })

  test('gives the screen of a screen address', () => {
    expect(routeOf('#/onboarding/welcome', screens)).toEqual({ kind: 'screen', screen: screens[1] })
    expect(routeOf('#/home', screens)).toEqual({ kind: 'screen', screen: screens[0] })
  })

  test('gives the screen of an encoded address and of an address with a slash at the end', () => {
    expect(routeOf('#/onboarding%2Fworkspace', screens)).toEqual({ kind: 'screen', screen: screens[2] })
    expect(routeOf('#/onboarding/workspace/', screens)).toEqual({ kind: 'screen', screen: screens[2] })
  })

  test('gives unknown for an id that no screen has', () => {
    expect(routeOf('#/nothing', screens)).toEqual({ kind: 'unknown', id: 'nothing' })
    expect(routeOf('#/onboarding', screens)).toEqual({ kind: 'unknown', id: 'onboarding' })
  })

  test('gives unknown for an escape that cannot be decoded', () => {
    expect(routeOf('#/bad%E0', screens)).toEqual({ kind: 'unknown', id: 'bad%E0' })
  })

  test('with an empty list: the index, and unknown for each id', () => {
    expect(routeOf('', [])).toEqual({ kind: 'index' })
    expect(routeOf('#/home', [])).toEqual({ kind: 'unknown', id: 'home' })
  })
})

describe('hashOf', () => {
  test('gives the text from the first #', () => {
    expect(hashOf('https://host/site/#/onboarding/welcome')).toBe('#/onboarding/welcome')
    expect(hashOf('https://host/site/#/a#b')).toBe('#/a#b')
  })

  test('gives a lone # as it is', () => {
    expect(hashOf('https://host/site/#')).toBe('#')
  })

  test('gives an empty text for an address with no hash', () => {
    expect(hashOf('https://host/site/')).toBe('')
    expect(hashOf('https://host/site/index.html?x=1')).toBe('')
  })
})

describe('changesPage', () => {
  test('no hash and a hash that starts with #/ change the page', () => {
    for (const hash of ['', '#/', '#//', '#/home', '#/nothing', '#/bad%E0']) expect(changesPage(hash)).toBe(true)
  })

  test('a different hash is a place on the current page', () => {
    for (const hash of ['#', '#top', '#main', '#home']) expect(changesPage(hash)).toBe(false)
  })
})

describe('titleOf', () => {
  test('a screen gives its title', () => {
    expect(titleOf({ kind: 'screen', screen: { ...screenEntry('home'), title: 'Home' } })).toBe('Home')
  })

  test('an unknown id gives a fixed title', () => {
    expect(titleOf({ kind: 'unknown', id: 'nothing' })).toBe(unknownTitle)
    expect(unknownTitle).toBe('Unknown screen')
  })

  test('the index gives a fixed title', () => {
    expect(titleOf({ kind: 'index' })).toBe(indexTitle)
    expect(indexTitle).toBe('Screens')
  })

  test('site.html has the title of the index before the site renders', () => {
    const html = readFileSync(new URL('../../site.html', import.meta.url), 'utf8')
    expect(html).toContain(`<title>${indexTitle}</title>`)
  })
})
