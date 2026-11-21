import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { config } from '../../canvas.config.ts'
import { screenIdFromSearch, screenModuleKey } from './screen-id.ts'

const keys = ['/screens/onboarding/welcome.tsx', '/screens/onboarding/welcome-mobile.tsx', '/screens/home.tsx']

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

describe('screenModuleKey', () => {
  test('gives the key of the module of a screen', () => {
    expect(screenModuleKey('onboarding/welcome', keys)).toBe('/screens/onboarding/welcome.tsx')
  })

  test('gives the key of a screen directly in the screens folder', () => {
    expect(screenModuleKey('home', keys)).toBe('/screens/home.tsx')
  })

  test('gives null for an id that is not in the list of modules', () => {
    expect(screenModuleKey('onboarding/missing', keys)).toBeNull()
    expect(screenModuleKey('../src/editor/main', keys)).toBeNull()
  })

  test('gives null for an empty list of modules', () => {
    expect(screenModuleKey('onboarding/welcome', [])).toBeNull()
  })
})

describe('the screens folder', () => {
  // `screenModuleKey` and the globs of the frame and of the site name the
  // folder as a literal (the dev server needs a literal glob). Change them
  // with the config.
  test('is the folder of the config', () => {
    expect(config.screens).toBe('screens')
  })

  test('is the folder of the glob in the frame entry and in the screen page of the site', () => {
    const glob = `'/${config.screens}/**/*.tsx'`
    for (const file of ['../frame/main.tsx', '../site/ScreenPage.tsx']) {
      const code = readFileSync(new URL(file, import.meta.url), 'utf8')
      expect(code, file).toContain(`import.meta.glob<ScreenModule>(${glob})`)
    }
  })
})
