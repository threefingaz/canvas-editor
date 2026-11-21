import { describe, expect, test, vi } from 'vitest'
import type { Token } from '../../tokens/format.ts'
import { createTokenStore } from './token-store.ts'
import type { TokenFile } from './token-file.ts'

function color(value: string): Token {
  return {
    id: 'palette.primary.main',
    group: 'color',
    name: 'primary.main',
    value,
    cssVar: '--mui-palette-primary-main',
    code: 'primary.main',
  }
}

function file(value: string): TokenFile {
  return { tokens: [color(value)], error: null }
}

describe('createTokenStore', () => {
  test('gives the file that it was created with', () => {
    const first = file('#1f4fd8')
    expect(createTokenStore(first).get()).toBe(first)
  })

  test('a new file replaces it and calls the subscribers', () => {
    const store = createTokenStore(file('#1f4fd8'))
    const listener = vi.fn()
    store.subscribe(listener)
    const next = file('#c2185b')
    store.set(next)
    expect(store.get()).toBe(next)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('a file with the same content changes nothing', () => {
    const first = file('#1f4fd8')
    const store = createTokenStore(first)
    const listener = vi.fn()
    store.subscribe(listener)
    store.set(file('#1f4fd8'))
    expect(store.get()).toBe(first)
    expect(listener).not.toHaveBeenCalled()
  })

  test('a file that cannot be read replaces the tokens, and the tokens come back after it', () => {
    const store = createTokenStore(file('#1f4fd8'))
    const listener = vi.fn()
    store.subscribe(listener)
    store.set({ tokens: null, error: 'There is no tokens.json.' })
    expect(store.get()).toEqual({ tokens: null, error: 'There is no tokens.json.' })
    store.set(file('#1f4fd8'))
    expect(store.get().tokens).toEqual([color('#1f4fd8')])
    expect(listener).toHaveBeenCalledTimes(2)
  })

  test('a subscriber that unsubscribes is not called again', () => {
    const store = createTokenStore(file('#1f4fd8'))
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.set(file('#c2185b'))
    expect(listener).not.toHaveBeenCalled()
  })
})
