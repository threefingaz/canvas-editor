import { describe, expect, test, vi } from 'vitest'
import { createOperateStore, navigateTarget } from './operate.ts'

const screens = [{ id: 'onboarding/welcome' }, { id: 'onboarding/workspace' }]

describe('navigateTarget', () => {
  test('a link to a screen gives the entry of that screen', () => {
    expect(navigateTarget({ kind: 'screen', id: 'onboarding/workspace' }, screens)).toBe(screens[1])
  })

  test('a link to an unknown screen gives null', () => {
    expect(navigateTarget({ kind: 'unknown-screen', id: 'onboarding/nothing' }, screens)).toBeNull()
  })

  test('an address that is not a screen address gives null', () => {
    expect(navigateTarget({ kind: 'other' }, screens)).toBeNull()
  })

  test('a screen id that is no longer in the list gives null', () => {
    expect(navigateTarget({ kind: 'screen', id: 'onboarding/removed' }, screens)).toBeNull()
  })

  test('an empty list gives null', () => {
    expect(navigateTarget({ kind: 'screen', id: 'onboarding/welcome' }, [])).toBeNull()
  })
})

describe('createOperateStore', () => {
  test('the switch starts off', () => {
    expect(createOperateStore().get()).toBe(false)
  })

  test('toggle turns the switch on and off again', () => {
    const store = createOperateStore()
    store.toggle()
    expect(store.get()).toBe(true)
    store.toggle()
    expect(store.get()).toBe(false)
  })

  test('each toggle calls the listeners, until they unsubscribe', () => {
    const store = createOperateStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.toggle()
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    store.toggle()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('two stores are separate', () => {
    const one = createOperateStore()
    const two = createOperateStore()
    one.toggle()
    expect(two.get()).toBe(false)
  })
})
