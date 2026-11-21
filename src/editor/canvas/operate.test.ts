import { describe, expect, test, vi } from 'vitest'
import { createOperateStore, followLink } from './operate.ts'

const welcome = { screen: { id: 'onboarding/welcome' } }
const workspace = { screen: { id: 'onboarding/workspace' } }
const frames = [welcome, workspace]

describe('followLink', () => {
  test('a link to a screen moves the view to the frame of that screen', () => {
    expect(followLink({ kind: 'screen', id: 'onboarding/workspace' }, frames)).toEqual({ kind: 'move', box: workspace })
  })

  test('a link to an unknown screen shows a message with its address', () => {
    expect(followLink({ kind: 'unknown-screen', id: 'onboarding/nothing' }, frames)).toEqual({
      kind: 'notice',
      text: 'The link goes to #/onboarding/nothing, and no screen has that address.',
    })
    expect(followLink({ kind: 'unknown-screen', id: 'a b' }, frames)).toEqual({
      kind: 'notice',
      text: 'The link goes to #/a%20b, and no screen has that address.',
    })
  })

  test('an address that is not a screen address, and no link, do nothing', () => {
    expect(followLink({ kind: 'other' }, frames)).toBeNull()
    expect(followLink(null, frames)).toBeNull()
  })

  test('a screen with no frame in the layout does nothing', () => {
    expect(followLink({ kind: 'screen', id: 'onboarding/removed' }, frames)).toBeNull()
    expect(followLink({ kind: 'screen', id: 'onboarding/welcome' }, [])).toBeNull()
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
