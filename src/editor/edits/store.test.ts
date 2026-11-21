import { describe, expect, test, vi } from 'vitest'
import type { Change, Edit, Target } from '../../requests/format.ts'
import { createEditsStore } from './store.ts'

const welcome = 'onboarding/welcome'
const profile = 'settings/profile'

const target: Target = {
  file: 'screens/onboarding/welcome.tsx',
  line: 12,
  column: 7,
  tag: 'Typography',
  origin: 'library',
  element: 'h1',
  copies: 1,
  label: 'Welcome',
}

function edit(id: string, change: Change = { kind: 'remove' }, at: Partial<Target> = {}): Edit {
  return { id, target: { ...target, ...at }, width: 390, change }
}

const text = (before: string, after: string): Change => ({ kind: 'text', before, after })

const ids = (store: ReturnType<typeof createEditsStore>, screenId: string) =>
  store.get(screenId).map((item) => item.edit.id)

describe('edits store', () => {
  test('holds the items of each screen', () => {
    const store = createEditsStore()
    expect(store.get(welcome)).toEqual([])
    store.apply(welcome, edit('e1'))
    store.apply(profile, edit('e2', undefined, { file: 'screens/settings/profile.tsx' }))
    expect(ids(store, welcome)).toEqual(['e1'])
    expect(ids(store, profile)).toEqual(['e2'])
    expect(Object.keys(store.screens()).sort()).toEqual([welcome, profile])
  })

  test('get gives the same list until the screen changes', () => {
    const store = createEditsStore()
    store.apply(welcome, edit('e1'))
    const list = store.get(welcome)
    store.apply(profile, edit('e2'))
    expect(store.get(welcome)).toBe(list)
    expect(store.get('none')).toBe(store.get('other'))
  })

  test('apply merges the edit into the list of its screen', () => {
    const store = createEditsStore()
    store.apply(welcome, edit('e1', text('Welcome', 'Hello')))
    store.apply(welcome, edit('e2', text('Hello', 'Hi')))
    expect(store.get(welcome)).toEqual([{ edit: edit('e2', text('Welcome', 'Hi')) }])
  })

  test('apply takes out the edits that the new edit replaces, in one history record', () => {
    const store = createEditsStore()
    const order = (before: number, after: number): Change => ({ kind: 'order', before, after, of: 3, previewed: true })
    store.apply(welcome, edit('e1', order(0, 1), { line: 12 }))
    store.apply(welcome, edit('e2', text('a', 'b')))
    store.apply(welcome, edit('e3', order(2, 1), { line: 14 }), ['e1', 'missing'])
    expect(ids(store, welcome)).toEqual(['e2', 'e3'])
    store.undo()
    expect(ids(store, welcome)).toEqual(['e1', 'e2'])
  })

  test('discard takes an edit out', () => {
    const store = createEditsStore()
    store.apply(welcome, edit('e1'))
    store.apply(welcome, edit('e2', text('a', 'b')))
    store.discard(welcome, 'e1')
    expect(ids(store, welcome)).toEqual(['e2'])
    store.discard(welcome, 'e2')
    expect(store.screens()).toEqual({})
  })

  test('undo and redo work on the edits of all screens', () => {
    const store = createEditsStore()
    store.apply(welcome, edit('e1'))
    store.apply(profile, edit('e2'))
    store.discard(welcome, 'e1')
    expect(store.canUndo()).toBe(true)
    expect(store.canRedo()).toBe(false)

    store.undo()
    expect(ids(store, welcome)).toEqual(['e1'])
    store.undo()
    expect(ids(store, profile)).toEqual([])
    expect(store.canRedo()).toBe(true)

    store.redo()
    expect(ids(store, profile)).toEqual(['e2'])
    store.apply(welcome, edit('e3', text('a', 'b')))
    expect(store.canRedo()).toBe(false)
  })

  test('replace sets the edits of a screen in each version and drops the steps of that screen only', () => {
    const store = createEditsStore()
    store.apply(welcome, edit('e1'))
    store.apply(profile, edit('e2'))
    store.apply(welcome, edit('e3', text('a', 'b')))
    store.replace(welcome, [edit('e5', text('a', 'c'))])
    expect(store.get(welcome)).toEqual([{ edit: edit('e5', text('a', 'c')) }])
    expect(ids(store, profile)).toEqual(['e2'])
    // The undo of the other screen still works; the screen keeps the edits of
    // the file.
    expect(store.canUndo()).toBe(true)
    store.undo()
    expect(ids(store, profile)).toEqual([])
    expect(ids(store, welcome)).toEqual(['e5'])
    expect(store.canUndo()).toBe(false)
    store.redo()
    expect(ids(store, profile)).toEqual(['e2'])
    expect(store.canRedo()).toBe(false)
    store.replace(welcome, [])
    expect(Object.keys(store.screens())).toEqual([profile])
  })

  test('replace with only one screen in the history leaves nothing to undo', () => {
    const store = createEditsStore()
    store.apply(welcome, edit('e1'))
    store.apply(welcome, edit('e2', text('a', 'b')))
    store.undo()
    store.replace(welcome, [edit('e5')])
    expect(store.canUndo()).toBe(false)
    expect(store.canRedo()).toBe(false)
  })

  test('mark sets and clears the stale mark with no history record', () => {
    const store = createEditsStore()
    store.apply(welcome, edit('e1'))
    store.apply(welcome, edit('e2', text('a', 'b')))
    store.mark(welcome, 'e1', true)
    expect(store.get(welcome)[0]).toEqual({ edit: edit('e1'), stale: true })
    // The mark is true in each version: an undo does not take it back.
    store.undo()
    expect(store.get(welcome)).toEqual([{ edit: edit('e1'), stale: true }])
    store.mark(welcome, 'e1', false)
    expect(store.get(welcome)).toEqual([{ edit: edit('e1') }])
    store.undo()
    expect(store.canUndo()).toBe(false)
  })

  test('retarget moves the target of an edit in each version with no history record', () => {
    const store = createEditsStore()
    store.apply(welcome, edit('e1'))
    store.apply(welcome, edit('e2', text('a', 'b'), { line: 30 }))
    store.retarget(welcome, 'e1', 14, 9)
    expect(store.get(welcome)[0].edit.target).toEqual({ ...target, line: 14, column: 9 })
    store.undo()
    expect(store.get(welcome)).toEqual([{ edit: edit('e1', undefined, { line: 14, column: 9 }) }])
    store.undo()
    expect(store.canUndo()).toBe(false)
  })

  test('subscribers get one call for each change', () => {
    const store = createEditsStore()
    const listener = vi.fn()
    const stop = store.subscribe(listener)
    store.apply(welcome, edit('e1'))
    store.apply(welcome, edit('e2', text('a', 'b')))
    store.discard(welcome, 'e2')
    store.undo()
    store.redo()
    store.mark(welcome, 'e1', true)
    store.retarget(welcome, 'e1', 2, 3)
    store.replace(profile, [edit('e3')])
    expect(listener).toHaveBeenCalledTimes(8)

    stop()
    store.apply(welcome, edit('e4', text('c', 'd')))
    expect(listener).toHaveBeenCalledTimes(8)
  })

  test('a step that changes nothing calls no subscriber', () => {
    const store = createEditsStore()
    store.apply(welcome, edit('e1'))
    const listener = vi.fn()
    store.subscribe(listener)
    store.apply(welcome, edit('e2'))
    store.apply(welcome, edit('e3', text('a', 'a')))
    store.discard(welcome, 'e9')
    store.redo()
    store.mark(welcome, 'e9', true)
    store.mark(welcome, 'e1', false)
    store.retarget(welcome, 'e9', 1, 1)
    store.retarget(welcome, 'e1', target.line, target.column)
    expect(listener).not.toHaveBeenCalled()
    expect(store.canUndo()).toBe(true)
    store.undo()
    expect(store.canUndo()).toBe(false)
  })

  test('a comment is added, changed and discarded, each with undo and redo', () => {
    const store = createEditsStore()
    const comment = (text: string): Edit => ({ id: 'c1', target: null, width: 390, change: { kind: 'comment', text } })
    const texts = () => store.get(welcome).map((item) => (item.edit.change.kind === 'comment' ? item.edit.change.text : ''))
    store.apply(welcome, comment('Add an empty state.'))
    store.apply(welcome, { ...comment('Make this a table.'), id: 'c2', target })
    expect(ids(store, welcome)).toEqual(['c1', 'c2'])

    store.changeComment(welcome, 'c1', 'Add an empty state with a retry.')
    expect(texts()).toEqual(['Add an empty state with a retry.', 'Make this a table.'])
    store.undo()
    expect(texts()).toEqual(['Add an empty state.', 'Make this a table.'])
    store.redo()
    expect(texts()).toEqual(['Add an empty state with a retry.', 'Make this a table.'])

    store.changeComment(welcome, 'c2', '')
    expect(ids(store, welcome)).toEqual(['c1'])
    store.undo()
    expect(ids(store, welcome)).toEqual(['c1', 'c2'])

    store.discard(welcome, 'c1')
    expect(ids(store, welcome)).toEqual(['c2'])
    store.undo()
    expect(ids(store, welcome)).toEqual(['c1', 'c2'])
    store.redo()
    expect(ids(store, welcome)).toEqual(['c2'])

    // Undo back to the start: the add of each comment is a step too.
    store.undo()
    store.undo()
    store.undo()
    store.undo()
    store.undo()
    expect(ids(store, welcome)).toEqual([])
    expect(store.canUndo()).toBe(false)
    store.redo()
    expect(ids(store, welcome)).toEqual(['c1'])
  })

  test('a change of a comment with the same text makes no history record', () => {
    const store = createEditsStore()
    store.apply(welcome, { id: 'c1', target: null, width: 390, change: { kind: 'comment', text: 'Add a title.' } })
    const list = store.get(welcome)
    store.changeComment(welcome, 'c1', 'Add a title.')
    store.changeComment(welcome, 'c9', 'Other')
    expect(store.get(welcome)).toBe(list)
    store.undo()
    expect(store.canUndo()).toBe(false)
  })

  test('retarget leaves a comment on the screen as it is', () => {
    const store = createEditsStore()
    store.apply(welcome, { id: 'c1', target: null, width: 390, change: { kind: 'comment', text: 'Add a title.' } })
    const list = store.get(welcome)
    store.retarget(welcome, 'c1', 20, 5)
    expect(store.get(welcome)).toBe(list)
  })
})
