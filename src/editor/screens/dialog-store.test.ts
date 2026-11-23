import { describe, expect, test, vi } from 'vitest'
import { createDialogStore } from './dialog-store.ts'

describe('createDialogStore', () => {
  test('opens one dialog at a time and tells the listeners', () => {
    const store = createDialogStore()
    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.get()).toBeNull()
    store.open({ kind: 'rename', screen: 'a/b' })
    expect(store.get()).toEqual({ kind: 'rename', screen: 'a/b' })
    store.open({ kind: 'refused', screen: 'a/b', reasons: ['x'] })
    expect(store.get()).toEqual({ kind: 'refused', screen: 'a/b', reasons: ['x'] })
    store.close()
    expect(store.get()).toBeNull()
    store.close()
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
