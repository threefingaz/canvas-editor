import { describe, expect, test, vi } from 'vitest'
import { createSelectionStore, sameElement, selectionKey, type Selected } from './store.ts'

// A plain object in place of a DOM node of the frame.
const node = (name: string) => ({ name }) as unknown as Element

function selected(overrides: Partial<Selected> = {}): Selected {
  return {
    screenId: 'onboarding/welcome',
    loc: 'screens/onboarding/welcome.tsx:30:11',
    index: 0,
    name: 'Button',
    node: node('a'),
    ...overrides,
  }
}

describe('sameElement', () => {
  test('the same screen, location and index are the same element', () => {
    expect(sameElement(selected(), selected({ node: node('b'), name: 'Other' }))).toBe(true)
  })

  test('a different screen is a different element', () => {
    expect(sameElement(selected(), selected({ screenId: 'onboarding/welcome-mobile' }))).toBe(false)
  })

  test('a different location is a different element', () => {
    expect(sameElement(selected(), selected({ loc: 'screens/onboarding/welcome.tsx:31:11' }))).toBe(false)
  })

  test('a different index among the elements of one location is a different element', () => {
    expect(sameElement(selected(), selected({ index: 1 }))).toBe(false)
  })

  test('null is the same as null only', () => {
    expect(sameElement(null, null)).toBe(true)
    expect(sameElement(selected(), null)).toBe(false)
    expect(sameElement(null, selected())).toBe(false)
  })
})

describe('selectionKey', () => {
  test('the same for the same element with a different node and name', () => {
    expect(selectionKey(selected())).toBe(selectionKey(selected({ node: node('b'), name: 'Other' })))
  })

  test('different for a different screen, place or index', () => {
    expect(selectionKey(selected())).not.toBe(selectionKey(selected({ screenId: 'onboarding/welcome-mobile' })))
    expect(selectionKey(selected())).not.toBe(selectionKey(selected({ loc: 'screens/onboarding/welcome.tsx:31:11' })))
    expect(selectionKey(selected())).not.toBe(selectionKey(selected({ index: 1 })))
  })
})

describe('createSelectionStore', () => {
  test('starts with no selection', () => {
    expect(createSelectionStore().get()).toBeNull()
  })

  test('select keeps the element and tells the listeners', () => {
    const store = createSelectionStore()
    const listener = vi.fn()
    store.subscribe(listener)
    const value = selected()
    store.select(value)
    expect(store.get()).toBe(value)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('clear removes the selection and tells the listeners', () => {
    const store = createSelectionStore()
    store.select(selected())
    const listener = vi.fn()
    store.subscribe(listener)
    store.clear()
    expect(store.get()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('clear with no selection does not tell the listeners', () => {
    const store = createSelectionStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.clear()
    expect(listener).not.toHaveBeenCalled()
  })

  test('the same element with the same node does not tell the listeners', () => {
    const store = createSelectionStore()
    const value = selected()
    store.select(value)
    const listener = vi.fn()
    store.subscribe(listener)
    store.select({ ...value })
    expect(store.get()).toBe(value)
    expect(listener).not.toHaveBeenCalled()
  })

  test('the same element with a new node replaces the selection', () => {
    const store = createSelectionStore()
    store.select(selected())
    const listener = vi.fn()
    store.subscribe(listener)
    const next = selected({ node: node('new document') })
    store.select(next)
    expect(store.get()).toBe(next)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('a listener stops after unsubscribe', () => {
    const store = createSelectionStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.select(selected())
    expect(listener).not.toHaveBeenCalled()
  })
})
