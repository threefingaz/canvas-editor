import { describe, expect, test } from 'vitest'
import type { Change, Edit, EditValue, Target } from '../../requests/format.ts'
import {
  addEdit,
  discard,
  editsOf,
  liveItems,
  locOf,
  replaceComment,
  sameTarget,
  screenComments,
  type Item,
} from './model.ts'

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

const other: Target = { ...target, line: 20, tag: 'Button', element: 'button' }

const sides = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']

const px = (value: string): EditValue => ({ value, observed: true })
const token = (id: string, value: string): EditValue => ({
  value,
  token: { id, name: id, code: Number(id.split('.')[1]) },
})

function edit(id: string, change: Change, at: Target = target): Edit {
  return { id, target: at, width: 390, change }
}

function style(id: string, properties: string[], before: EditValue, after: EditValue, at = target): Edit {
  return edit(id, { kind: 'style', properties, before, after }, at)
}

const ids = (list: Item[]) => list.map((item) => item.edit.id)

describe('sameTarget', () => {
  test('the same file, line and column are the same target', () => {
    const copy: Target = { ...target, label: 'Other', copies: 3 }
    expect(sameTarget(target, copy)).toBe(true)
    // A screen element of the anchor has a place too.
    expect(sameTarget({ file: target.file, line: 12, column: 7 }, target)).toBe(true)
  })

  test('the target null of a screen comment is the same only as null', () => {
    expect(sameTarget(null, null)).toBe(true)
    expect(sameTarget(null, target)).toBe(false)
    expect(sameTarget(target, null)).toBe(false)
  })

  test('a different line, column or file is a different target', () => {
    expect(sameTarget(target, { ...target, line: 13 })).toBe(false)
    expect(sameTarget(target, { ...target, column: 8 })).toBe(false)
    expect(sameTarget(target, { ...target, file: 'screens/onboarding/other.tsx' })).toBe(false)
  })
})

describe('locOf', () => {
  test('is the location part of a place', () => {
    expect(locOf(target)).toBe('screens/onboarding/welcome.tsx:12:7')
    expect(locOf({ file: target.file, line: 3, column: 5 })).toBe('screens/onboarding/welcome.tsx:3:5')
  })
})

describe('addEdit', () => {
  test('appends an edit to the list', () => {
    const first = addEdit([], style('e1', sides, px('20px'), token('spacing.2', '16px')))
    const next = addEdit(first, edit('e2', { kind: 'remove' }, other))
    expect(ids(next)).toEqual(['e1', 'e2'])
    expect(next[1]).toEqual({ edit: edit('e2', { kind: 'remove' }, other) })
  })

  test('does not change the list it gets', () => {
    const list: Item[] = [{ edit: style('e1', sides, px('20px'), token('spacing.2', '16px')) }]
    addEdit(list, style('e2', ['padding-top'], token('spacing.2', '16px'), token('spacing.3', '24px')))
    expect(list[0].edit.change).toMatchObject({ properties: sides })
  })

  test('a new style edit takes its properties out of an earlier edit on the same target', () => {
    let list = addEdit([], style('e1', sides, px('20px'), token('spacing.2', '16px')))
    list = addEdit(list, style('e2', ['padding-top'], token('spacing.2', '16px'), token('spacing.3', '24px')))
    expect(list.map((item) => item.edit)).toEqual([
      style('e1', ['padding-right', 'padding-bottom', 'padding-left'], px('20px'), token('spacing.2', '16px')),
      // The first `before` of the property stays.
      style('e2', ['padding-top'], px('20px'), token('spacing.3', '24px')),
    ])
  })

  test('an earlier edit with no properties left goes out', () => {
    let list = addEdit([], style('e1', ['padding-top'], px('20px'), token('spacing.2', '16px')))
    list = addEdit(list, style('e2', sides, px('20px'), token('spacing.3', '24px')))
    expect(list.map((item) => item.edit)).toEqual([style('e2', sides, px('20px'), token('spacing.3', '24px'))])
  })

  test('a style edit on a different target or other properties keeps the earlier edit', () => {
    let list = addEdit([], style('e1', ['padding-top'], px('20px'), token('spacing.2', '16px')))
    list = addEdit(list, style('e2', ['padding-top'], px('8px'), token('spacing.1', '8px'), other))
    list = addEdit(list, style('e3', ['margin-top'], px('4px'), token('spacing.1', '8px')))
    expect(ids(list)).toEqual(['e1', 'e2', 'e3'])
    expect(list[0].edit.change).toMatchObject({ properties: ['padding-top'], before: px('20px') })
  })

  test('an edit back to its first value goes out with the earlier edit', () => {
    let list = addEdit([], style('e1', sides, px('20px'), token('spacing.2', '16px')))
    list = addEdit(list, style('e2', sides, token('spacing.2', '16px'), px('20px')))
    expect(list).toEqual([])
  })

  test('an edit whose after is equal to its before goes out', () => {
    const list: Item[] = [{ edit: edit('e0', { kind: 'remove' }, other) }]
    expect(addEdit(list, style('e1', sides, token('spacing.2', '16px'), token('spacing.2', '16px')))).toBe(list)
    expect(addEdit(list, edit('e2', { kind: 'text', before: 'Hi', after: 'Hi' }))).toBe(list)
  })

  test('the same value with a new token stays', () => {
    const list = addEdit([], style('e1', ['gap'], px('16px'), token('spacing.2', '16px')))
    expect(ids(list)).toEqual(['e1'])
  })

  test('the same value with a different token stays', () => {
    const list = addEdit([], style('e1', ['gap'], token('spacing.2', '16px'), token('size.2', '16px')))
    expect(ids(list)).toEqual(['e1'])
  })

  test('a later order edit on the same target replaces the earlier one and keeps its before', () => {
    const order = (id: string, before: number, after: number) =>
      edit(id, { kind: 'order', before, after, of: 4, previewed: true })
    let list = addEdit([], order('e1', 3, 2))
    list = addEdit(list, edit('e2', { kind: 'remove' }, other))
    list = addEdit(list, order('e3', 2, 1))
    expect(list.map((item) => item.edit)).toEqual([edit('e2', { kind: 'remove' }, other), order('e3', 3, 1)])
    expect(addEdit(list, order('e4', 1, 3)).map((item) => item.edit)).toEqual([
      edit('e2', { kind: 'remove' }, other),
    ])
  })

  test('a later text edit or text style edit replaces the earlier one and keeps its before', () => {
    let list = addEdit([], edit('e1', { kind: 'text', before: 'Welcome', after: 'Hello' }))
    list = addEdit(list, edit('e2', { kind: 'text', before: 'Hello', after: 'Hi' }))
    expect(list.map((item) => item.edit)).toEqual([edit('e2', { kind: 'text', before: 'Welcome', after: 'Hi' })])

    list = addEdit(list, edit('e3', { kind: 'textStyle', before: px('13px'), after: token('type.2', '14px') }))
    list = addEdit(list, edit('e4', { kind: 'textStyle', before: token('type.2', '14px'), after: px('13px') }))
    expect(ids(list)).toEqual(['e2'])
  })

  test('a text, text style or order edit with the same after as the earlier edit gives the same list', () => {
    const text = addEdit([], edit('e1', { kind: 'text', before: 'Welcome', after: 'Hello' }))
    expect(addEdit(text, edit('e2', { kind: 'text', before: 'Hello', after: 'Hello' }))).toBe(text)

    const textStyle = addEdit([], edit('e1', { kind: 'textStyle', before: px('13px'), after: token('type.2', '14px') }))
    expect(addEdit(textStyle, edit('e2', { kind: 'textStyle', before: px('13px'), after: token('type.2', '14px') }))).toBe(
      textStyle,
    )

    const order = addEdit([], edit('e1', { kind: 'order', before: 2, after: 1, of: 3, previewed: true }))
    expect(addEdit(order, edit('e2', { kind: 'order', before: 1, after: 1, of: 3, previewed: true }))).toBe(order)
  })

  test('a remove edit keeps the other edits of its target in the list', () => {
    let list = addEdit([], style('e1', ['gap'], px('16px'), token('spacing.2', '16px')))
    list = addEdit(list, edit('e2', { kind: 'text', before: 'Welcome', after: 'Hello' }))
    list = addEdit(list, edit('e3', { kind: 'remove' }))
    expect(ids(list)).toEqual(['e1', 'e2', 'e3'])
  })

  test('a second remove edit on the same target changes nothing', () => {
    const list = addEdit([], edit('e1', { kind: 'remove' }))
    expect(addEdit(list, edit('e2', { kind: 'remove' }))).toBe(list)
  })

  test('a remove, text or order edit replaces an earlier edit with a reply, also with the same after', () => {
    const reply = { status: 'conflict' as const, text: 'The element is gone' }
    const removed: Item = { edit: { ...edit('e1', { kind: 'remove' }), reply } }
    expect(addEdit([removed], edit('e2', { kind: 'remove' }))).toEqual([{ edit: edit('e2', { kind: 'remove' }) }])
    const texted: Item = { edit: { ...edit('e1', { kind: 'text', before: 'Welcome', after: 'Hello' }), reply } }
    expect(addEdit([texted], edit('e2', { kind: 'text', before: 'Hello', after: 'Hello' }))).toEqual([
      { edit: edit('e2', { kind: 'text', before: 'Welcome', after: 'Hello' }) },
    ])
    expect(addEdit([texted], edit('e2', { kind: 'text', before: 'Hello', after: 'Hi' }))).toEqual([
      { edit: edit('e2', { kind: 'text', before: 'Welcome', after: 'Hi' }) },
    ])
    const order = { kind: 'order' as const, before: 0, after: 2, of: 3, previewed: true }
    const ordered: Item = { edit: { ...edit('e1', order), reply } }
    expect(addEdit([ordered], edit('e2', { ...order, before: 2 }))).toEqual([{ edit: edit('e2', order) }])
  })

  test('an earlier edit that changes keeps its reply', () => {
    const reply = { status: 'unclear' as const, text: 'Which side?' }
    const list: Item[] = [{ edit: { ...style('e1', sides, px('20px'), token('spacing.2', '16px')), reply } }]
    const next = addEdit(list, style('e2', ['padding-top'], token('spacing.2', '16px'), token('spacing.3', '24px')))
    expect(next[0]).toMatchObject({ edit: { reply, change: { properties: sides.slice(1) } } })
    expect(next[1]).toEqual({ edit: style('e2', ['padding-top'], px('20px'), token('spacing.3', '24px')) })
  })

  test('a stale item on the same place is not an earlier edit and stays as it is', () => {
    const staleStyle: Item = { edit: style('e1', sides, px('20px'), token('spacing.2', '16px')), stale: true }
    const staleText: Item = { edit: edit('e2', { kind: 'text', before: 'Welcome', after: 'Hello' }), stale: true }
    const staleRemove: Item = { edit: edit('e3', { kind: 'remove' }), stale: true }
    let list = addEdit([staleStyle, staleText, staleRemove], style('e4', ['padding-top'], px('8px'), token('spacing.3', '24px')))
    list = addEdit(list, edit('e5', { kind: 'text', before: 'Start', after: 'Go' }))
    list = addEdit(list, edit('e6', { kind: 'remove' }))
    expect(list.slice(0, 3)).toEqual([staleStyle, staleText, staleRemove])
    expect(list.slice(3)).toEqual([
      { edit: style('e4', ['padding-top'], px('8px'), token('spacing.3', '24px')) },
      { edit: edit('e5', { kind: 'text', before: 'Start', after: 'Go' }) },
      { edit: edit('e6', { kind: 'remove' }) },
    ])
  })
})

describe('discard', () => {
  test('takes the edit with the id out of the list', () => {
    const list: Item[] = [{ edit: edit('e1', { kind: 'remove' }) }, { edit: edit('e2', { kind: 'remove' }, other) }]
    expect(ids(discard(list, 'e1'))).toEqual(['e2'])
  })

  test('an unknown id gives the same list', () => {
    const list: Item[] = [{ edit: edit('e1', { kind: 'remove' }) }]
    expect(discard(list, 'e9')).toBe(list)
  })
})

describe('editsOf', () => {
  test('gives the items of one target in the sequence of the list', () => {
    const list: Item[] = [
      { edit: edit('e1', { kind: 'remove' }) },
      { edit: edit('e2', { kind: 'remove' }, other) },
      { edit: edit('e3', { kind: 'text', before: 'a', after: 'b' }, { ...target, label: 'b' }) },
    ]
    expect(ids(editsOf(target, list))).toEqual(['e1', 'e3'])
    expect(editsOf({ ...target, line: 99 }, list)).toEqual([])
  })
})

const comment = (id: string, text: string, at: Target | null = target): Edit => ({
  id,
  target: at,
  width: 390,
  change: { kind: 'comment', text },
})

describe('comments', () => {
  test('two comments on one element stay two', () => {
    let list = addEdit([], comment('c1', 'Make this a table.'))
    list = addEdit(list, comment('c2', 'Make this a table.'))
    expect(ids(list)).toEqual(['c1', 'c2'])
  })

  test('a comment and a style edit on one element do not touch each other', () => {
    let list = addEdit([], style('e1', sides, px('20px'), token('spacing.2', '16px')))
    list = addEdit(list, comment('c1', 'Use a card here.'))
    list = addEdit(list, style('e2', sides, token('spacing.2', '16px'), token('spacing.3', '24px')))
    expect(list).toEqual([
      { edit: comment('c1', 'Use a card here.') },
      { edit: style('e2', sides, px('20px'), token('spacing.3', '24px')) },
    ])
    // A remove edit keeps the comments of its element.
    list = addEdit(list, edit('e3', { kind: 'remove' }))
    expect(ids(list)).toEqual(['c1', 'e2', 'e3'])
  })

  test('a comment on the screen is a new item, also next to a comment on an element', () => {
    let list = addEdit([], comment('c1', 'Add an empty state.', null))
    list = addEdit(list, comment('c2', 'Add an empty state.', null))
    list = addEdit(list, comment('c3', 'Make this bold.'))
    expect(ids(list)).toEqual(['c1', 'c2', 'c3'])
    expect(ids(screenComments(list))).toEqual(['c1', 'c2'])
    expect(ids(editsOf(null, list))).toEqual(['c1', 'c2'])
    expect(ids(editsOf(target, list))).toEqual(['c3'])
  })

  test('a comment with an empty text is not added', () => {
    const list: Item[] = []
    expect(addEdit(list, comment('c1', ''))).toBe(list)
    expect(addEdit(list, comment('c1', '  \n '))).toBe(list)
  })

  test('a comment has no preview', () => {
    const list: Item[] = [
      { edit: comment('c1', 'Make this a table.') },
      { edit: comment('c2', 'Add an empty state.', null) },
      { edit: edit('e1', { kind: 'remove' }) },
    ]
    expect(ids(liveItems(list))).toEqual(['e1'])
  })
})

describe('replaceComment', () => {
  const list: Item[] = [
    { edit: comment('c1', 'Make this a table.') },
    { edit: edit('e1', { kind: 'text', before: 'a', after: 'b' }) },
    { edit: comment('c2', 'Add an empty state.', null) },
  ]

  test('changes the text and keeps the id, the target and the place in the list', () => {
    const next = replaceComment(list, 'c2', 'Add an empty state and a retry.')
    expect(next[2]).toEqual({ edit: comment('c2', 'Add an empty state and a retry.', null) })
    expect(next[0]).toBe(list[0])
    expect(next[1]).toBe(list[1])
    expect(list[2]).toEqual({ edit: comment('c2', 'Add an empty state.', null) })
  })

  test('an empty text discards the comment', () => {
    expect(ids(replaceComment(list, 'c1', '   '))).toEqual(['e1', 'c2'])
  })

  test('the same text, an unknown id and an id of a different kind give the same list', () => {
    expect(replaceComment(list, 'c1', 'Make this a table.')).toBe(list)
    expect(replaceComment(list, 'c9', 'Other')).toBe(list)
    expect(replaceComment(list, 'e1', 'Other')).toBe(list)
  })

  test('a new text takes out the reply of the agent and keeps the stale mark', () => {
    const reply = { status: 'unclear' as const, text: 'Which table?' }
    const replied: Item[] = [{ edit: { ...comment('c1', 'Make this a table.'), reply }, stale: true }]
    expect(replaceComment(replied, 'c1', 'Make this a table of the members.')).toEqual([
      { edit: comment('c1', 'Make this a table of the members.'), stale: true },
    ])
    // The same text asks again: the reply goes out.
    expect(replaceComment(replied, 'c1', 'Make this a table.')).toEqual([
      { edit: comment('c1', 'Make this a table.'), stale: true },
    ])
  })
})
