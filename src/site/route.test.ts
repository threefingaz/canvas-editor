import { describe, expect, test } from 'vitest'
import type { ScreenEntry } from 'virtual:canvas-screens'
import { routeOf } from './route.ts'

function entry(id: string): ScreenEntry {
  const slash = id.lastIndexOf('/')
  return {
    id,
    flow: slash === -1 ? '' : id.slice(0, slash),
    name: id.slice(slash + 1),
    title: id,
    width: 1440,
    file: `screens/${id}.tsx`,
  }
}

const screens = [entry('home'), entry('onboarding/welcome'), entry('onboarding/workspace')]

describe('routeOf', () => {
  test('gives the index for the forms of the index', () => {
    for (const hash of ['', '#', '#/', '#//']) {
      expect(routeOf(hash, screens)).toEqual({ kind: 'index' })
    }
  })

  test('gives the index for a hash that is not a screen address', () => {
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
