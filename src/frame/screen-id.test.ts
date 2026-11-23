import { describe, expect, test } from 'vitest'
import { frameAddress, frameBase, screenIdFromSearch, screenLoader } from './screen-id.ts'

const load = () => Promise.resolve({})
const modules = { 'onboarding/welcome': load, 'onboarding/welcome-mobile': load, home: load }

describe('screenIdFromSearch', () => {
  test('reads the id of a screen', () => {
    expect(screenIdFromSearch('?screen=onboarding/welcome')).toBe('onboarding/welcome')
  })

  test('reads an encoded id and ignores other parameters', () => {
    expect(screenIdFromSearch('?zoom=2&screen=onboarding%2Fwelcome-mobile')).toBe('onboarding/welcome-mobile')
  })

  test('reads a search with no question mark', () => {
    expect(screenIdFromSearch('screen=home')).toBe('home')
  })

  test('gives null when there is no `screen` parameter', () => {
    expect(screenIdFromSearch('')).toBeNull()
    expect(screenIdFromSearch('?zoom=2')).toBeNull()
  })

  test('gives null when the `screen` parameter is empty', () => {
    expect(screenIdFromSearch('?screen=')).toBeNull()
  })
})

describe('screenLoader', () => {
  test('gives the loader of the module of a screen', () => {
    expect(screenLoader('onboarding/welcome', modules)).toBe(load)
    expect(screenLoader('home', modules)).toBe(load)
  })

  test('gives null for an id that is not in the map', () => {
    expect(screenLoader('onboarding/missing', modules)).toBeNull()
    expect(screenLoader('../src/editor/main', modules)).toBeNull()
  })

  test('gives null for a name of the prototype of an object', () => {
    expect(screenLoader('__proto__', modules)).toBeNull()
    expect(screenLoader('toString', modules)).toBeNull()
  })

  test('gives null for an empty map', () => {
    expect(screenLoader('onboarding/welcome', {})).toBeNull()
  })
})

describe('frameAddress', () => {
  test('is the frame entry below the frame server, with the encoded id', () => {
    expect(frameBase).toBe('/__frame/')
    expect(frameAddress('onboarding/welcome')).toBe('/__frame/frame.html?screen=onboarding%2Fwelcome')
  })
})
