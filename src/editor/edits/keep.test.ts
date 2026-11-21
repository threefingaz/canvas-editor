import { describe, expect, test } from 'vitest'
import type { Edit, Target } from '../../requests/format.ts'
import { editBlock, keepBlock, keepState, keepView, openKeep, staleKeep } from './keep.ts'
import type { Item } from './model.ts'

const target: Target = {
  file: 'screens/onboarding/welcome.tsx',
  line: 12,
  column: 7,
  tag: 'Card',
  origin: 'library',
  element: 'div',
  copies: 1,
  label: 'Welcome',
}

const first = 'onboarding/welcome-option-1'
const second = 'onboarding/welcome-option-2'

const remove = (id: string): Edit => ({ id, target, width: 1440, change: { kind: 'remove' } })
const comment = (id: string, text: string, at: Target | null = target): Edit => ({
  id,
  target: at,
  width: 1440,
  change: { kind: 'comment', text },
})
const options = (id: string, at: Target | null = target): Edit => ({
  id,
  target: at,
  width: 1440,
  change: { kind: 'options', count: 3, note: '' },
})
const keep = (id: string, option: string): Edit => ({ id, target: null, width: 1440, change: { kind: 'keep', option } })

const screenComment: Item = { edit: comment('c1', 'Add a title.', null) }
const placed: Item = { edit: remove('r1') }
const asked: Item = { edit: options('o1', null) }
const keepOf = (option: string): Item => ({ edit: keep('k1', option) })

describe('openKeep', () => {
  test('gives the keep item of the list, or null', () => {
    expect(openKeep([])).toBeNull()
    expect(openKeep([screenComment, { edit: options('o1') }])).toBeNull()
    const item = { edit: keep('k1', first), stale: true as const }
    expect(openKeep([screenComment, item])).toBe(item)
  })
})

describe('keepBlock', () => {
  test('is null for an empty list and for comments on the screen only', () => {
    expect(keepBlock([])).toBeNull()
    expect(keepBlock([screenComment])).toBeNull()
  })

  test('is null for the list with its own keep', () => {
    expect(keepBlock([keepOf(first)])).toBeNull()
  })

  test('gives the reason for an open item with a target', () => {
    expect(keepBlock([placed])).toMatch(/edits on its elements/)
    expect(keepBlock([{ edit: comment('c2', 'Make this a table.') }])).toMatch(/edits on its elements/)
    // A stale item is still in the file.
    expect(keepBlock([{ ...placed, stale: true }])).toMatch(/edits on its elements/)
  })

  test('gives the reason for an open options item, on the screen or on an element', () => {
    expect(keepBlock([asked])).toMatch(/request for options/)
    expect(keepBlock([{ edit: options('o2') }])).toMatch(/request for options/)
  })
})

describe('editBlock', () => {
  test('null with no open keep', () => {
    expect(editBlock([])).toBeNull()
    expect(editBlock([screenComment])).toBeNull()
  })

  test('the reason with an open keep, also a stale one', () => {
    expect(editBlock([screenComment, keepOf(first)])).toMatch(/keep an option/)
    expect(editBlock([{ ...keepOf(first), stale: true }])).toMatch(/keep an option/)
  })
})

describe('keepState', () => {
  test('free for a base with no items, or only comments on the screen', () => {
    expect(keepState(first, [])).toEqual({ kind: 'free' })
    expect(keepState(first, [screenComment])).toEqual({ kind: 'free' })
  })

  test('free when the open keep is of a different option: a new one replaces it', () => {
    expect(keepState(second, [keepOf(first)])).toEqual({ kind: 'free' })
  })

  test('kept when the open keep is of this option', () => {
    expect(keepState(first, [screenComment, keepOf(first)])).toEqual({ kind: 'kept' })
  })

  test('blocked by an open edit on an element of the base', () => {
    const state = keepState(first, [placed])
    expect(state.kind).toBe('blocked')
    expect(state.kind === 'blocked' && state.reason).toMatch(/edits on its elements/)
  })

  test('blocked by an open options item of the base', () => {
    const state = keepState(first, [asked])
    expect(state.kind === 'blocked' && state.reason).toMatch(/request for options/)
  })

  test('kept wins over an item with a target and an open options item of the base', () => {
    expect(keepState(first, [placed, asked, keepOf(first)])).toEqual({ kind: 'kept' })
  })

  test('blocked when the open keep is of a different option and the base has an item with a target', () => {
    const state = keepState(second, [placed, keepOf(first)])
    expect(state.kind === 'blocked' && state.reason).toMatch(/edits on its elements/)
  })
})

describe('keepView', () => {
  test('no button and no mark for a screen that is not an option', () => {
    expect(keepView(first, null, false)).toEqual({ state: null, kept: false })
  })

  test('the state of the button, and the mark with the open keep of the option', () => {
    expect(keepView(first, [], false)).toEqual({ state: { kind: 'free' }, kept: false })
    expect(keepView(first, [keepOf(first)], false)).toEqual({ state: { kind: 'kept' }, kept: true })
    expect(keepView(second, [keepOf(first)], false)).toEqual({ state: { kind: 'free' }, kept: false })
  })

  test('with the Preview switch on, no button, and the mark stays', () => {
    expect(keepView(first, [], true)).toEqual({ state: null, kept: false })
    expect(keepView(first, [keepOf(first)], true)).toEqual({ state: null, kept: true })
  })
})

describe('staleKeep', () => {
  test('a keep whose option is not in the list', () => {
    expect(staleKeep(keep('k1', 'a'), ['a', 'b'])).toBe(false)
    expect(staleKeep(keep('k1', 'gone'), ['a', 'b'])).toBe(true)
  })

  test('false for a different kind', () => {
    expect(staleKeep(comment('c1', 'A note', null), [])).toBe(false)
  })
})
