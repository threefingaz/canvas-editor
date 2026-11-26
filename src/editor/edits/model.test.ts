import { describe, expect, test } from 'vitest'
import type { Change, Edit, EditValue, Target } from '../../requests/format.ts'
import {
  addEdit,
  discard,
  editsOf,
  liveItems,
  locOf,
  optionsAsked,
  replaceComment,
  sameComment,
  sameTarget,
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

  test('a row of four sides over an earlier edit of one side keeps the value in the code of each side', () => {
    // The code has 8px on the right and 16px on the other sides; the user set
    // the right to 16px, then all four sides to 24px.
    let list = addEdit([], style('e1', ['padding-right'], px('8px'), px('16px')))
    list = addEdit(list, style('e2', sides, px('16px'), px('24px')))
    expect(list.map((item) => item.edit)).toEqual([
      style('e2', ['padding-top', 'padding-bottom', 'padding-left'], px('16px'), px('24px')),
      style('e2-2', ['padding-right'], px('8px'), px('24px')),
    ])
    // All four sides to 8px: the right is back at its code value; the others
    // change.
    list = addEdit(list, style('e3', sides, px('24px'), px('8px')))
    expect(list.map((item) => item.edit)).toEqual([style('e3', ['padding-top', 'padding-bottom', 'padding-left'], px('16px'), px('8px'))])
  })

  test('a second edit of a value of a media rule keeps the media of the first one', () => {
    // The page shows the preview of the first edit, which has no media rule.
    const first = edit('e1', { kind: 'style', properties: sides, before: px('16px'), after: px('24px'), media: '(min-width: 900px)' })
    let list = addEdit([], first)
    list = addEdit(list, style('e2', sides, px('24px'), px('32px')))
    expect(list.map((item) => item.edit)).toEqual([
      edit('e2', { kind: 'style', properties: sides, before: px('16px'), after: px('32px'), media: '(min-width: 900px)' }),
    ])
    // One side of a value with no media rule, then the four sides: two edits.
    list = addEdit([], first)
    list = addEdit(list, style('e3', ['padding-top'], px('24px'), px('8px')))
    expect(list.map((item) => item.edit)).toEqual([
      edit('e1', { kind: 'style', properties: sides.slice(1), before: px('16px'), after: px('24px'), media: '(min-width: 900px)' }),
      edit('e3', { kind: 'style', properties: ['padding-top'], before: px('16px'), after: px('8px'), media: '(min-width: 900px)' }),
    ])
  })

  test('a style edit of the same properties with the same after gives the same list', () => {
    const list = addEdit([], style('e1', sides, px('20px'), token('spacing.2', '16px')))
    expect(addEdit(list, style('e2', [...sides].reverse(), token('spacing.2', '16px'), token('spacing.2', '16px')))).toBe(list)
    // A part of the properties is a new edit of those.
    expect(ids(addEdit(list, style('e2', ['padding-top'], token('spacing.2', '16px'), token('spacing.2', '16px'))))).toEqual(['e1', 'e2'])
    // An earlier edit with a reply is made again.
    const replied: Item[] = [{ edit: { ...list[0].edit, reply: { status: 'unclear', text: 'Which?' } } }]
    expect(ids(addEdit(replied, style('e2', sides, token('spacing.2', '16px'), token('spacing.2', '16px'))))).toEqual(['e2'])
  })

  test('a row of four sides with the same after as the parts of a split edit gives the same list', () => {
    let list = addEdit([], style('e1', ['padding-right'], px('8px'), px('16px')))
    list = addEdit(list, style('e2', sides, px('16px'), px('24px')))
    expect(ids(list)).toEqual(['e2', 'e2-2'])
    expect(addEdit(list, style('e3', sides, px('24px'), px('24px')))).toBe(list)
    // A part with a different after is a new edit.
    const changed: Item[] = [list[0], { edit: { ...list[1].edit, change: { ...list[1].edit.change, after: px('20px') } as Change } }]
    expect(addEdit(changed, style('e3', sides, px('24px'), px('24px')))).not.toBe(changed)
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

const options = (id: string, count = 3, note = '', at: Target | null = target): Edit => ({
  id,
  target: at,
  width: 390,
  change: { kind: 'options', count, note },
})

const keep = (id: string, option: string): Edit => ({ id, target: null, width: 1440, change: { kind: 'keep', option } })

describe('options and keep', () => {
  test('have no preview', () => {
    const list: Item[] = [
      { edit: options('o1') },
      { edit: options('o2', 2, 'Fewer fields', null) },
      { edit: keep('k1', 'onboarding/welcome-option-1') },
      { edit: edit('e1', { kind: 'remove' }) },
    ]
    expect(ids(liveItems(list))).toEqual(['e1'])
  })

  test('two options items on one element stay two, also with the same count and note', () => {
    let list = addEdit([], options('o1', 3, 'Shorter'))
    list = addEdit(list, options('o2', 3, 'Shorter'))
    expect(ids(list)).toEqual(['o1', 'o2'])
  })

  test('two options items on the screen stay two', () => {
    let list = addEdit([], options('o1', 3, '', null))
    list = addEdit(list, options('o2', 4, '', null))
    expect(ids(list)).toEqual(['o1', 'o2'])
  })

  test('an options item with an empty note is added', () => {
    expect(ids(addEdit([], options('o1', 2, '')))).toEqual(['o1'])
  })

  test('a second keep leaves one item, the new one, with no before', () => {
    let list = addEdit([], comment('c1', 'Add a title.', null))
    list = addEdit(list, keep('k1', 'onboarding/welcome-option-1'))
    list = addEdit(list, keep('k2', 'onboarding/welcome-option-2'))
    expect(ids(list)).toEqual(['c1', 'k2'])
    expect(list[1]).toEqual({ edit: keep('k2', 'onboarding/welcome-option-2') })
    expect(list[1].edit.change).not.toHaveProperty('before')
  })

  test('a keep does not touch a comment on the screen or an options item', () => {
    let list = addEdit([], options('o1', 3, '', null))
    list = addEdit(list, comment('c1', 'Add a title.', null))
    list = addEdit(list, keep('k1', 'onboarding/welcome-option-1'))
    expect(ids(list)).toEqual(['o1', 'c1', 'k1'])
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

describe('sameComment', () => {
  const reply = { status: 'unclear' as const, text: 'Which table?' }

  test('the same text and no reply, or the same reply, is the same', () => {
    expect(sameComment(comment('c1', 'Make this a table.'), comment('c1', 'Make this a table.'))).toBe(true)
    expect(sameComment({ ...comment('c1', 'A'), reply }, { ...comment('c1', 'A'), reply: { ...reply } })).toBe(true)
  })

  test('a new text is not the same', () => {
    expect(sameComment(comment('c1', 'Make this a table.'), comment('c1', 'Make this a list.'))).toBe(false)
  })

  test('a new reply, or a reply that goes out, is not the same', () => {
    expect(sameComment(comment('c1', 'A'), { ...comment('c1', 'A'), reply })).toBe(false)
    expect(sameComment({ ...comment('c1', 'A'), reply }, comment('c1', 'A'))).toBe(false)
    expect(sameComment({ ...comment('c1', 'A'), reply }, { ...comment('c1', 'A'), reply: { ...reply, text: 'Other' } })).toBe(
      false,
    )
  })

  test('an edit that is not a comment is never the same', () => {
    const text = edit('e1', { kind: 'text', before: 'a', after: 'b' })
    expect(sameComment(text, text)).toBe(false)
    expect(sameComment(comment('c1', 'A'), text)).toBe(false)
  })
})

describe('optionsAsked', () => {
  const options = (id: string, count: number, at: Target | null): Item => ({
    edit: { id, target: at, width: 1440, change: { kind: 'options', count, note: '' } },
  })
  const comment: Item = { edit: { id: 'c1', target, width: 1440, change: { kind: 'comment', text: 'A table' } } }

  test('no options item gives null', () => {
    expect(optionsAsked([])).toBeNull()
    expect(optionsAsked([comment])).toBeNull()
  })

  test('one request of the screen', () => {
    expect(optionsAsked([comment, options('o1', 3, null)])).toEqual({ requests: 1, options: 3 })
  })

  test('the requests of the screen and of its elements add up, a stale one too', () => {
    const stale: Item = { ...options('o3', 2, other), stale: true }
    expect(optionsAsked([options('o1', 3, null), options('o2', 4, target), stale])).toEqual({ requests: 3, options: 9 })
  })

  test('a request with a reply of the agent is still open in the file, thus it counts', () => {
    const replied: Item = { edit: { ...options('o1', 3, null).edit, reply: { status: 'unclear', text: 'Which part?' } } }
    expect(optionsAsked([replied])).toEqual({ requests: 1, options: 3 })
  })
})
