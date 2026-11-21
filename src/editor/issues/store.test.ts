import { describe, expect, test, vi } from 'vitest'
import type { Issue, Target } from '../../requests/format.ts'
import { createIssuesStore, sameIssues } from './store.ts'

const target: Target = {
  file: 'screens/onboarding/welcome.tsx',
  line: 12,
  column: 7,
  tag: 'div',
  origin: 'host',
  element: 'div',
  copies: 1,
  label: 'Footer',
}

const notLibrary: Issue = { kind: 'not-library', target }
const gap: Issue = { kind: 'no-token', target, property: 'gap', value: '16px', state: 'none' }

describe('sameIssues', () => {
  test('compares the content of two lists', () => {
    expect(sameIssues([notLibrary, gap], [{ ...notLibrary }, { ...gap }])).toBe(true)
    expect(sameIssues([notLibrary, gap], [gap, notLibrary])).toBe(false)
    expect(sameIssues([gap], [{ ...gap, value: '17px' }])).toBe(false)
    expect(sameIssues([], [])).toBe(true)
    expect(sameIssues([gap], [])).toBe(false)
  })
})

describe('createIssuesStore', () => {
  test('keeps the issues of each screen', () => {
    const store = createIssuesStore()
    expect(store.get('one')).toBeUndefined()
    store.set('one', [notLibrary])
    store.set('two', [gap])
    expect(store.get('one')).toEqual([notLibrary])
    expect(store.get('two')).toEqual([gap])
    expect(Object.keys(store.screens())).toEqual(['one', 'two'])
  })

  test('a new list calls the subscribers and gives a new map of screens', () => {
    const store = createIssuesStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.set('one', [notLibrary])
    const first = store.screens()
    store.set('one', [notLibrary, gap])
    expect(listener).toHaveBeenCalledTimes(2)
    expect(store.screens()).not.toBe(first)
    expect(store.get('one')).toEqual([notLibrary, gap])
  })

  test('equal content causes no call of the subscribers and keeps the lists', () => {
    const store = createIssuesStore()
    store.set('one', [notLibrary, gap])
    const list = store.get('one')
    const screens = store.screens()
    const listener = vi.fn()
    store.subscribe(listener)
    store.set('one', [{ ...notLibrary }, { ...gap }])
    expect(listener).not.toHaveBeenCalled()
    expect(store.get('one')).toBe(list)
    expect(store.screens()).toBe(screens)
  })

  test('an empty list is kept: the screen has no issues', () => {
    const store = createIssuesStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.set('one', [])
    expect(store.get('one')).toEqual([])
    expect(listener).toHaveBeenCalledTimes(1)
    store.set('one', [])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('a subscriber that unsubscribes gets no more calls', () => {
    const store = createIssuesStore()
    const listener = vi.fn()
    const stop = store.subscribe(listener)
    stop()
    store.set('one', [gap])
    expect(listener).not.toHaveBeenCalled()
  })
})
