import { afterEach, describe, expect, test, vi } from 'vitest'
import { nextChoice, parseChoice, readChoice, writeChoice, type EditorTheme, type ThemeChoice } from './theme.ts'

type ChoiceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function memoryStorage(initial: Record<string, string> = {}): ChoiceStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

const failingStorage: ChoiceStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

// The theme that the editor shows: the choice, else the system theme.
const shown = (system: EditorTheme, choice: ThemeChoice) => choice ?? system

describe('nextChoice', () => {
  test('with no choice, chooses the theme that is not the system theme', () => {
    expect(nextChoice('light', null)).toBe('dark')
    expect(nextChoice('dark', null)).toBe('light')
  })

  test('back to the system theme clears the choice', () => {
    expect(nextChoice('light', 'dark')).toBeNull()
    expect(nextChoice('dark', 'light')).toBeNull()
  })

  test('a choice equal to the system theme changes to the other theme', () => {
    expect(nextChoice('light', 'light')).toBe('dark')
    expect(nextChoice('dark', 'dark')).toBe('light')
  })

  test('the result always shows the other theme', () => {
    for (const system of ['light', 'dark'] as const) {
      for (const choice of [null, 'light', 'dark'] as const) {
        expect(shown(system, nextChoice(system, choice))).not.toBe(shown(system, choice))
      }
    }
  })
})

describe('parseChoice', () => {
  test('reads a stored theme', () => {
    expect(parseChoice('light')).toBe('light')
    expect(parseChoice('dark')).toBe('dark')
  })

  test('gives null for no value and for an unknown value', () => {
    expect(parseChoice(null)).toBeNull()
    expect(parseChoice('')).toBeNull()
    expect(parseChoice('blue')).toBeNull()
  })
})

describe('readChoice and writeChoice', () => {
  // The browser storage of the editor window.
  function stubStorage(storage: ChoiceStorage) {
    vi.stubGlobal('window', { localStorage: storage })
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('a written choice reads back', () => {
    stubStorage(memoryStorage())
    writeChoice('dark')
    expect(readChoice()).toBe('dark')
  })

  test('writing null removes the choice', () => {
    const storage = memoryStorage()
    stubStorage(storage)
    writeChoice('light')
    writeChoice(null)
    expect(storage.data).toEqual({})
    expect(readChoice()).toBeNull()
  })

  test('an unknown stored value reads as no choice', () => {
    const storage = memoryStorage()
    stubStorage(storage)
    writeChoice('dark')
    const key = Object.keys(storage.data)[0]
    storage.data[key] = 'blue'
    expect(readChoice()).toBeNull()
  })

  test('a storage that throws reads as no choice and a write does not throw', () => {
    stubStorage(failingStorage)
    expect(readChoice()).toBeNull()
    expect(() => writeChoice('dark')).not.toThrow()
  })

  test('with no window, as in Node, there is no storage and no error', () => {
    expect(readChoice()).toBeNull()
    expect(() => writeChoice('dark')).not.toThrow()
  })
})
