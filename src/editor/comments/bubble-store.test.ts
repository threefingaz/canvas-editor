import { describe, expect, test } from 'vitest'
import { createSelectionStore, type Selected } from '../selection/store.ts'
import { createBubbleStore, followSelection } from './bubble-store.ts'
import { draftKey, liveTarget, type Bubble } from './bubble.ts'

const target = { screenId: 'onboarding/welcome', loc: null }

describe('createBubbleStore', () => {
  test('an event that changes the state notifies; one that changes nothing does not', () => {
    const store = createBubbleStore()
    let calls = 0
    store.subscribe(() => calls++)
    store.send({ type: 'close' })
    expect(calls).toBe(0)
    store.send({ type: 'open-new', target })
    expect(store.get()).toEqual({ kind: 'new', target })
    expect(calls).toBe(1)
    store.send({ type: 'selected', same: true })
    expect(calls).toBe(1)
    store.send({ type: 'selected', same: false })
    expect(store.get()).toEqual({ kind: 'closed' })
    expect(calls).toBe(2)
  })

  test('a draft stays for its place until it is emptied, also while the bubble is closed', () => {
    const store = createBubbleStore()
    expect(store.draft('a')).toBe('')
    store.setDraft('a', 'Make this a table')
    store.send({ type: 'open-new', target })
    store.send({ type: 'close' })
    expect(store.draft('a')).toBe('Make this a table')
    expect(store.draft('b')).toBe('')
    store.setDraft('a', '')
    expect(store.draft('a')).toBe('')
  })
})

describe('followSelection', () => {
  const at = (loc: string, node: object): Selected => ({
    screenId: 'onboarding/welcome',
    loc,
    index: 0,
    name: 'Card',
    node: node as Element,
  })

  test('a different element closes the bubble; the same element with a new node keeps it', () => {
    const selected = createSelectionStore()
    const store = createBubbleStore()
    followSelection(store, selected)
    selected.select(at('a', {}))
    store.send({ type: 'open-new', target })
    selected.select(at('a', {}))
    expect(store.get().kind).toBe('new')
    selected.select(at('b', {}))
    expect(store.get().kind).toBe('closed')
  })

  test('no element closes the bubble, and the stop ends the follow', () => {
    const selected = createSelectionStore()
    const store = createBubbleStore()
    const stop = followSelection(store, selected)
    selected.select(at('a', {}))
    store.send({ type: 'open-new', target })
    selected.clear()
    expect(store.get().kind).toBe('closed')
    store.send({ type: 'open-new', target })
    stop()
    selected.select(at('b', {}))
    expect(store.get().kind).toBe('new')
  })
})

describe('an element that the agent moved or took out of the screen file', () => {
  const screenId = 'onboarding/welcome'
  const from = 'screens/onboarding/welcome.tsx:12:7'
  const to = 'screens/onboarding/welcome.tsx:15:7'
  const at = (loc: string): Selected => ({ screenId, loc, index: 0, name: 'Card', node: {} as Element })

  test('the draft of the place moves to the new place and joins a draft there', () => {
    const store = createBubbleStore()
    store.setDraft(draftKey({ screenId, loc: from }), 'Make this a table')
    store.send({ type: 'moved', screenId, from, to })
    expect(store.draft(draftKey({ screenId, loc: from }))).toBe('')
    expect(store.draft(draftKey({ screenId, loc: to }))).toBe('Make this a table')
    store.setDraft(draftKey({ screenId, loc: from }), 'Shorter')
    store.send({ type: 'moved', screenId, from, to })
    expect(store.draft(draftKey({ screenId, loc: to }))).toBe('Make this a table\n\nShorter')
  })

  test('a move of the selection keeps the bubble open at the new place', () => {
    const selected = createSelectionStore()
    const store = createBubbleStore()
    followSelection(store, selected)
    selected.select(at(from))
    store.send({ type: 'open-new', target: { screenId, loc: from } })
    store.send({ type: 'moved', screenId, from, to })
    store.keepOpen(() => selected.select(at(to)))
    expect(store.get()).toMatchObject({ kind: 'new', target: { screenId, loc: to } })
  })

  test('a selection that clears because its element is gone keeps the bubble of its place open', () => {
    const selected = createSelectionStore()
    const store = createBubbleStore()
    followSelection(store, selected)
    selected.select(at(from))
    store.setDraft(draftKey({ screenId, loc: from }), 'Make this a table')
    store.send({ type: 'open-new', target: { screenId, loc: from } })
    store.keepOpen(() => selected.clear())
    expect(selected.get()).toBeNull()
    expect(store.get()).toEqual({ kind: 'new', target: { screenId, loc: from } })
    expect(store.draft(draftKey({ screenId, loc: from }))).toBe('Make this a table')
  })

  test('a gone element detaches the bubble of its place, which keeps the draft under its old place', () => {
    // Button A at 14:7 is selected with a typed draft; the agent removes it,
    // and Button B lands at 14:7. The selection clears (followPlace is not
    // certain); the bubble stays open, but no longer finds an element there.
    const selected = createSelectionStore()
    const store = createBubbleStore()
    followSelection(store, selected)
    selected.select(at(from))
    store.setDraft(draftKey({ screenId, loc: from }), 'Make this a table')
    store.send({ type: 'open-new', target: { screenId, loc: from } })
    store.send({ type: 'gone', screenId, loc: from })
    store.keepOpen(() => selected.clear())
    expect(store.get()).toMatchObject({ kind: 'new', target: { screenId, loc: from }, detached: true })
    expect(liveTarget(store.get() as Exclude<Bubble, { kind: 'closed' }>)).toBeNull()
    expect(store.draft(draftKey({ screenId, loc: from }))).toBe('Make this a table')
  })

  test('the bubble of the comments on the screen stays open while the selection follows its element', () => {
    const selected = createSelectionStore()
    const store = createBubbleStore()
    followSelection(store, selected)
    selected.select(at(from))
    const onScreen = { kind: 'pin', screenId, ids: ['e2'], target: { screenId, loc: null } } as const
    store.send({ type: 'open-pin', screenId, ids: ['e2'], target: { screenId, loc: null } })
    store.send({ type: 'moved', screenId, from, to })
    store.keepOpen(() => selected.select(at(to)))
    expect(selected.get()?.loc).toBe(to)
    expect(store.get()).toEqual(onScreen)
    store.keepOpen(() => selected.clear())
    expect(store.get()).toEqual(onScreen)
  })

  test('only the change inside keepOpen closes nothing: a later selection of the user closes the bubble', () => {
    const selected = createSelectionStore()
    const store = createBubbleStore()
    followSelection(store, selected)
    selected.select(at(from))
    store.send({ type: 'open-new', target: { screenId, loc: null } })
    store.keepOpen(() => selected.select(at(to)))
    selected.select(at('screens/onboarding/welcome.tsx:3:5'))
    expect(store.get().kind).toBe('closed')
  })
})
