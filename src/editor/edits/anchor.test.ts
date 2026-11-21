import { describe, expect, test } from 'vitest'
import type { Change, Target } from '../../requests/format.ts'
import { anchor, anchorScreen, anchorWrites, baseOf, nextReading, type Reading, type ScreenElement } from './anchor.ts'
import type { Item, PlacedEdit } from './model.ts'
import { createEditsStore } from './store.ts'

const file = 'screens/onboarding/welcome.tsx'

const target: Target = {
  file,
  line: 12,
  column: 7,
  tag: 'Typography',
  origin: 'library',
  element: 'h1',
  copies: 1,
  label: 'Welcome',
}

const text: Change = { kind: 'text', before: 'Welcome', after: 'Hello' }

function edit(id: string, at: Partial<Target> = {}, change: Change = text): PlacedEdit {
  return { id, target: { ...target, ...at }, width: 390, change }
}

const element = (line: number, column: number, tag: string, label: string, at = file): ScreenElement => ({
  file: at,
  line,
  column,
  tag,
  label,
})

describe('anchor of a target from the request file (unknown)', () => {
  const check = (value: PlacedEdit, elements: ScreenElement[]) => anchor(value, 'unknown', elements, [])

  test('the same tag and the same label at the target give ok', () => {
    const elements = [element(10, 5, 'Stack', 'Welcome Start'), element(12, 7, 'Typography', 'Welcome')]
    expect(check(edit('e1'), elements)).toEqual({ status: 'ok' })
  })

  test('an empty label of the edit needs only the tag at the target', () => {
    expect(check(edit('e1', { label: '' }), [element(12, 7, 'Typography', 'Hello')])).toEqual({ status: 'ok' })
  })

  test('one copy of the place with the label is sufficient', () => {
    const elements = [element(12, 7, 'Typography', 'Tag'), element(12, 7, 'Typography', 'Welcome')]
    expect(check(edit('e1'), elements)).toEqual({ status: 'ok' })
  })

  test('a different element at the target and one match in the document give moved', () => {
    const elements = [element(12, 7, 'Button', 'Start'), element(13, 7, 'Typography', 'Welcome')]
    expect(check(edit('e1'), elements)).toEqual({ status: 'moved', line: 13, column: 7 })
  })

  test('no element at the target and one match give moved, also with a new column', () => {
    expect(check(edit('e1'), [element(14, 9, 'Typography', 'Welcome')])).toEqual({ status: 'moved', line: 14, column: 9 })
  })

  test('the copies of one place are one match', () => {
    const elements = [element(20, 7, 'Typography', 'Welcome'), element(20, 7, 'Typography', 'Welcome')]
    expect(check(edit('e1'), elements)).toEqual({ status: 'moved', line: 20, column: 7 })
  })

  test('no match gives stale', () => {
    expect(check(edit('e1'), [element(12, 7, 'Typography', 'Hello')])).toEqual({ status: 'stale' })
    expect(check(edit('e1'), [])).toEqual({ status: 'stale' })
  })

  test('more than one match gives stale', () => {
    const elements = [element(13, 7, 'Typography', 'Welcome'), element(30, 7, 'Typography', 'Welcome')]
    expect(check(edit('e1'), elements)).toEqual({ status: 'stale' })
  })

  test('a match in a different file does not count', () => {
    expect(check(edit('e1'), [element(12, 7, 'Typography', 'Welcome', 'screens/other.tsx')])).toEqual({ status: 'stale' })
  })

  test('an edit with an empty label does not move by the tag alone', () => {
    const elements = [element(30, 5, 'Box', ''), element(31, 5, 'Box', 'Text')]
    expect(check(edit('e1', { tag: 'Box', label: '' }), elements)).toEqual({ status: 'stale' })
  })

  test('a remove edit does not move by the label: it could hide a different element that looks the same', () => {
    const removal = edit('e1', {}, { kind: 'remove' })
    expect(check(removal, [element(13, 7, 'Typography', 'Welcome')])).toEqual({ status: 'stale' })
    expect(check(removal, [element(12, 7, 'Typography', 'Welcome')])).toEqual({ status: 'ok' })
  })
})

describe('anchor of a target of the current document', () => {
  test('the element at the target gives ok', () => {
    expect(anchor(edit('e1', { label: '' }), 'current', [element(12, 7, 'Typography', 'Hi')], [])).toEqual({ status: 'ok' })
  })

  test('with no element at the target the edit is stale: in one document a place does not move', () => {
    // The element left the page for a short time (a state update); the same
    // look at a different place is a different element of the code.
    const elements = [element(20, 7, 'Typography', 'Welcome')]
    expect(anchor(edit('e1'), 'current', elements, [])).toEqual({ status: 'stale' })
  })
})

describe('anchor of a target of an older document (lost)', () => {
  test('stays stale, also with an element that looks the same at the target', () => {
    expect(anchor(edit('e1'), 'lost', [element(12, 7, 'Typography', 'Welcome')], [])).toEqual({ status: 'stale' })
  })
})

describe('anchor of a target of the document before', () => {
  // Before: a section with a heading, an icon button, a divider and a button.
  const previous = [
    element(10, 5, 'Stack', 'Welcome Start'),
    element(12, 7, 'Typography', 'Welcome'),
    element(14, 7, 'IconButton', ''),
    element(16, 7, 'Divider', ''),
    element(18, 7, 'Button', 'Start'),
  ]
  // After: the agent removed one line above the section, for example an
  // import that is no longer used.
  const shifted = previous.map((before) => ({ ...before, line: before.line - 1 }))
  const icon = edit('e1', { line: 14, tag: 'IconButton', element: 'button', label: '' })
  const removal = edit('e2', { line: 16, tag: 'Divider', element: 'hr', label: '' }, { kind: 'remove' })
  const check = (value: PlacedEdit, elements: ScreenElement[], before = previous) => anchor(value, 'previous', elements, before)

  test('nothing changed: ok', () => {
    expect(check(icon, previous)).toEqual({ status: 'ok' })
    expect(check(removal, previous)).toEqual({ status: 'ok' })
    expect(check(edit('e3'), previous)).toEqual({ status: 'ok' })
  })

  test('an edit with an empty label follows its element after lines change above it', () => {
    expect(check(icon, shifted)).toEqual({ status: 'moved', line: 13, column: 7 })
  })

  test('a remove edit follows its element after lines change above it', () => {
    expect(check(removal, shifted)).toEqual({ status: 'moved', line: 15, column: 7 })
    expect(check(edit('e3', {}, { kind: 'remove' }), shifted)).toEqual({ status: 'moved', line: 11, column: 7 })
  })

  test('a look-alike that the shift brings to the old place is not taken', () => {
    // Before: dividers at lines 16 and 18, with a note between them; the edit
    // is on the first. Two lines above the section are removed: the dividers
    // are at lines 14 and 16 now, and the second one is at the old place of
    // the first.
    const before = [
      ...previous.slice(0, 4),
      element(17, 7, 'Typography', 'Note'),
      element(18, 7, 'Divider', ''),
      element(20, 7, 'Button', 'Start'),
    ]
    const after = before.map((now) => ({ ...now, line: now.line - 2 }))
    expect(check(removal, after, before)).toEqual({ status: 'moved', line: 14, column: 7 })
    // A labeled edit whose label is at two places, likewise.
    const twice = [
      ...previous.slice(0, 4),
      element(18, 7, 'Button', 'Edit'),
      element(19, 7, 'Typography', 'Note'),
      element(20, 7, 'Button', 'Edit'),
    ]
    const moved = twice.map((now) => ({ ...now, line: now.line - 2 }))
    const button = edit('e4', { line: 18, tag: 'Button', element: 'button', label: 'Edit' })
    expect(check(button, moved, twice)).toEqual({ status: 'moved', line: 16, column: 7 })
  })

  test('two elements with the tag of the target between the landmarks give stale', () => {
    // Before: two dividers next to each other; the edit is on the first. They
    // could have changed places: the tags, the columns and the lines are the
    // same either way.
    const before = [...previous.slice(0, 4), element(18, 7, 'Divider', ''), element(20, 7, 'Button', 'Start')]
    const after = before.map((now) => ({ ...now, line: now.line - 2 }))
    expect(check(removal, after, before)).toEqual({ status: 'stale' })
    // A labeled edit whose label is at two places, likewise.
    const twice = [...previous.slice(0, 4), element(18, 7, 'Button', 'Edit'), element(20, 7, 'Button', 'Edit')]
    const button = edit('e4', { line: 18, tag: 'Button', element: 'button', label: 'Edit' })
    expect(check(button, twice.map((now) => ({ ...now, line: now.line - 2 })), twice)).toEqual({ status: 'stale' })
  })

  test('two avatars with no text that change places give stale', () => {
    // <Avatar src="a.png" /> and <Avatar src="b.png" /> trade places: the
    // screen elements are the same lists before and after.
    const before = [
      element(10, 5, 'Stack', 'Welcome Start'),
      element(12, 7, 'Typography', 'Welcome'),
      element(14, 7, 'Avatar', ''),
      element(15, 7, 'Avatar', ''),
      element(17, 7, 'Button', 'Start'),
    ]
    const avatar = edit('e7', { line: 14, tag: 'Avatar', element: 'div', label: '' })
    expect(check(avatar, before, before)).toEqual({ status: 'stale' })
    expect(check(edit('e8', { line: 15, tag: 'Avatar', element: 'div', label: '' }), before, before)).toEqual({
      status: 'stale',
    })
  })

  test('two dividers with a different sx that change places after a change of lines above give stale', () => {
    // <Divider /> and <Divider sx={{ my: 4 }} /> trade places, and one line
    // above the section is removed.
    const before = [
      element(10, 5, 'Stack', 'Welcome Start'),
      element(12, 7, 'Typography', 'Welcome'),
      element(14, 7, 'Divider', ''),
      element(16, 7, 'Divider', ''),
      element(18, 7, 'Button', 'Start'),
    ]
    const after = before.map((now) => ({ ...now, line: now.line - 1 }))
    expect(check(removal, after, before)).toEqual({ status: 'stale' })
    expect(check(edit('e9', { line: 16, tag: 'Divider', element: 'hr', label: '' }), after, before)).toEqual({
      status: 'stale',
    })
  })

  test('an applied removal does not move onto a different element that looks the same', () => {
    // Before: a second divider below the first. The agent removed the first
    // divider and the import line: the second one is now at line 15, one line
    // above the place of the first one.
    const before = [...previous.slice(0, 4), element(17, 7, 'Divider', ''), element(19, 7, 'Button', 'Start')]
    const after = [
      element(9, 5, 'Stack', 'Welcome Start'),
      element(11, 7, 'Typography', 'Welcome'),
      element(13, 7, 'IconButton', ''),
      element(15, 7, 'Divider', ''),
      element(17, 7, 'Button', 'Start'),
    ]
    expect(check(removal, after, before)).toEqual({ status: 'stale' })
    // The icon button between the same two landmarks cannot tell either: it is
    // stale too.
    expect(check(icon, after, before)).toEqual({ status: 'stale' })
  })

  test('an applied removal with no change of lines above does not leave the edit on the next look-alike', () => {
    // The agent removed the first divider (two lines): the second one is at
    // the old place now.
    const before = [...previous.slice(0, 4), element(18, 7, 'Divider', ''), element(20, 7, 'Button', 'Start')]
    const after = [...previous.slice(0, 3), element(16, 7, 'Divider', ''), element(18, 7, 'Button', 'Start')]
    expect(check(removal, after, before)).toEqual({ status: 'stale' })
  })

  test('two elements with no text that change places give stale', () => {
    const before = [
      element(10, 5, 'Stack', 'Welcome Start'),
      element(12, 7, 'IconButton', ''),
      element(12, 19, 'EditIcon', ''),
      element(13, 7, 'IconButton', ''),
      element(13, 19, 'DeleteIcon', ''),
      element(15, 7, 'Button', 'Start'),
    ]
    const after = [
      ...before.slice(0, 2),
      element(12, 19, 'DeleteIcon', ''),
      before[3],
      element(13, 19, 'EditIcon', ''),
      before[5],
    ]
    const first = edit('e5', { tag: 'IconButton', element: 'button', label: '' })
    expect(check(first, after, before)).toEqual({ status: 'stale' })
  })

  test('a removed element with a label does not move onto a copy that looks the same', () => {
    // Before: two buttons with the text Start; the agent removed the first.
    const before = [...previous, element(20, 7, 'Button', 'Start')]
    const after = [...shifted.slice(0, 4), element(17, 7, 'Button', 'Start')]
    const start = edit('e4', { line: 18, tag: 'Button', element: 'button', label: 'Start' }, { kind: 'remove' })
    expect(check(start, after, before)).toEqual({ status: 'stale' })
  })

  test('an applied move gives stale: the look at a new place is not certain', () => {
    // The heading is below the button now. Its look is at one place now, but
    // its neighbors do not confirm the move.
    const after = [
      shifted[0],
      element(11, 7, 'Button', 'Start'),
      element(13, 7, 'IconButton', ''),
      element(15, 7, 'Divider', ''),
      element(17, 7, 'Typography', 'Welcome'),
    ]
    expect(check(edit('e3', {}, { kind: 'remove' }), after)).toEqual({ status: 'stale' })
    expect(check(edit('e3'), after)).toEqual({ status: 'stale' })
  })

  test('a removal does not move onto a different element that gets the same look in the same pass', () => {
    // Before: the action stack of card A has the text Save, the stack of card
    // B has Save and Cancel. The agent removed the stack of card A (three
    // lines) and the Cancel button of card B (one line): the stack of card B
    // is the only stack with the text Save now.
    const before = [
      element(10, 5, 'Card', 'Card ASave'),
      element(11, 7, 'Typography', 'Card A'),
      element(12, 7, 'Stack', 'Save'),
      element(13, 9, 'Button', 'Save'),
      element(16, 5, 'Card', 'Card BSaveCancel'),
      element(17, 7, 'Typography', 'Card B'),
      element(18, 7, 'Stack', 'SaveCancel'),
      element(19, 9, 'Button', 'Save'),
      element(20, 9, 'Button', 'Cancel'),
    ]
    const after = [
      element(10, 5, 'Card', 'Card A'),
      element(11, 7, 'Typography', 'Card A'),
      element(13, 5, 'Card', 'Card BSave'),
      element(14, 7, 'Typography', 'Card B'),
      element(15, 7, 'Stack', 'Save'),
      element(16, 9, 'Button', 'Save'),
    ]
    const stack = edit('r1', { line: 12, tag: 'Stack', element: 'div', label: 'Save' }, { kind: 'remove' })
    expect(check(stack, after, before)).toEqual({ status: 'stale' })
  })

  test('a removal does not stay on a renamed sibling that has its text now', () => {
    // Before: the buttons Save and Submit. The agent removed Save (one line)
    // and changed the text of Submit to Save: that button is at the old place
    // of Save now.
    const before = [
      element(8, 5, 'Typography', 'Profile'),
      element(10, 5, 'Stack', 'SaveSubmit'),
      element(11, 7, 'Button', 'Save'),
      element(12, 7, 'Button', 'Submit'),
      element(14, 5, 'Typography', 'Footer'),
    ]
    const after = [
      element(8, 5, 'Typography', 'Profile'),
      element(10, 5, 'Stack', 'Save'),
      element(11, 7, 'Button', 'Save'),
      element(13, 5, 'Typography', 'Footer'),
    ]
    const save = { line: 11, tag: 'Button', element: 'button', label: 'Save' }
    expect(check(edit('r2', save, { kind: 'remove' }), after, before)).toEqual({ status: 'stale' })
    expect(check(edit('r3', save), after, before)).toEqual({ status: 'stale' })
  })

  test('a landmark whose look goes to a different element in the same pass gives stale', () => {
    // Before: card A has a stack with Save and Cancel and a divider; card B,
    // the last on the page, has a stack with Save and a divider. The user has
    // an open edit on the divider of card B; the agent removed card B and the
    // Cancel button of card A. The stack of card A is the only stack with the
    // text Save now: the look "Stack Save" is at one place in each document,
    // but on a different element, and the elements after it look the same.
    const before = [
      element(5, 5, 'Card', 'ProfileSaveCancel'),
      element(6, 7, 'Typography', 'Profile'),
      element(8, 7, 'Stack', 'SaveCancel'),
      element(9, 9, 'Button', 'Save'),
      element(10, 9, 'Button', 'Cancel'),
      element(12, 7, 'Divider', ''),
      element(14, 5, 'Card', 'Save'),
      element(16, 7, 'Stack', 'Save'),
      element(17, 9, 'Button', 'Save'),
      element(19, 7, 'Divider', ''),
    ]
    const after = [
      element(5, 5, 'Card', 'ProfileSave'),
      element(6, 7, 'Typography', 'Profile'),
      element(8, 7, 'Stack', 'Save'),
      element(9, 9, 'Button', 'Save'),
      element(11, 7, 'Divider', ''),
    ]
    const divider = { line: 19, tag: 'Divider', element: 'hr', label: '' }
    expect(check(edit('r4', divider, { kind: 'remove' }), after, before)).toEqual({ status: 'stale' })
    const color: Change = {
      kind: 'style',
      properties: ['border-color'],
      before: { value: '#e0e0e0', observed: true },
      after: { value: '#1F4FD8', token: { id: 'palette.primary.main', name: 'primary.main', code: 'primary.main' } },
    }
    expect(check(edit('r5', divider, color), after, before)).toEqual({ status: 'stale' })
    // The button of card B, likewise.
    const button = edit('r6', { line: 17, column: 9, tag: 'Button', element: 'button', label: 'Save' })
    expect(check(button, after, before)).toEqual({ status: 'stale' })
  })

  test('a repeated structure with more than one longest alignment gives stale', () => {
    // Three cards with the same elements and their own titles; the agent
    // removed the second card. The tags and columns of the third card could
    // be those of the second one now: the edit on its divider is stale.
    const card = (line: number, title: string) => [
      element(line, 5, 'Card', title),
      element(line + 1, 7, 'Typography', title),
      element(line + 2, 7, 'Divider', ''),
    ]
    const before = [...card(10, 'One'), ...card(14, 'Two'), ...card(18, 'Three')]
    const after = [...card(10, 'One'), ...card(14, 'Three')]
    const divider = edit('r7', { line: 20, tag: 'Divider', element: 'hr', label: '' })
    expect(check(divider, after, before)).toEqual({ status: 'stale' })
    // With no change of the structure, the same edit follows its element.
    const shiftedCards = before.map((now) => ({ ...now, line: now.line - 1 }))
    expect(check(divider, shiftedCards, before)).toEqual({ status: 'moved', line: 19, column: 7 })
  })

  test('two cards that trade places give stale for the elements in them', () => {
    // The titles are landmarks, but the alignment of the tags pairs each card
    // with its old place: the looks and the alignment do not agree.
    const card = (line: number, title: string) => [
      element(line, 5, 'Card', title),
      element(line + 1, 7, 'Typography', title),
      element(line + 2, 7, 'Divider', ''),
    ]
    const before = [element(8, 5, 'Typography', 'Profile'), ...card(10, 'One'), ...card(14, 'Two')]
    const after = [element(8, 5, 'Typography', 'Profile'), ...card(10, 'Two'), ...card(14, 'One')]
    expect(check(edit('r8', { line: 12, tag: 'Divider', element: 'hr', label: '' }), after, before)).toEqual({
      status: 'stale',
    })
  })

  test('a different label at the new place gives stale', () => {
    // The heading has a different text now: as for a target of the current
    // document, the label of the target must be at the new place.
    const after = shifted.map((now) => (now.tag === 'Typography' ? { ...now, label: 'Hello' } : now))
    expect(check(edit('e3'), after)).toEqual({ status: 'stale' })
    // An edit with an empty label needs only the tag.
    expect(check(icon, after)).toEqual({ status: 'moved', line: 13, column: 7 })
  })

  test('with no landmark on one side, the elements up to the end of the file decide', () => {
    const before = previous.slice(0, 4)
    expect(check(removal, shifted.slice(0, 4), before)).toEqual({ status: 'moved', line: 15, column: 7 })
    // An element added at the end of the file: not certain.
    const longer = [...shifted.slice(0, 4), element(18, 7, 'Divider', '')]
    expect(check(removal, longer, before)).toEqual({ status: 'stale' })
  })

  test('a changed text between the landmarks does not stop the move', () => {
    const before = [...previous.slice(0, 3), element(15, 7, 'Typography', 'Note'), ...previous.slice(3)]
    const after = before.map((now) => ({ ...now, line: now.line - 1, label: now.label === 'Note' ? 'Notes' : now.label }))
    expect(check(removal, after, before)).toEqual({ status: 'moved', line: 15, column: 7 })
  })

  test('neighbors that moved by a different number of lines give stale', () => {
    const after = shifted.map((now) => (now.tag === 'Button' ? { ...now, line: now.line + 3 } : now))
    expect(check(icon, after)).toEqual({ status: 'stale' })
  })

  test('neighbors that moved a column give stale', () => {
    const after = shifted.map((now) => ({ ...now, column: now.column + 2 }))
    expect(check(icon, after)).toEqual({ status: 'stale' })
  })

  test('a different element at the new place gives stale', () => {
    const after = shifted.map((now) => (now.tag === 'IconButton' ? { ...now, tag: 'Avatar' } : now))
    expect(check(icon, after)).toEqual({ status: 'stale' })
  })

  test('a target that is not an element of the document before gives stale', () => {
    expect(check(edit('e6', { line: 15, tag: 'Divider', label: '' }), shifted)).toEqual({ status: 'stale' })
  })

  test('a label that is at more than one place is not a landmark', () => {
    // The heading text is also on a second element: the nearest landmark
    // before the icon button is the section, which moved by one line too.
    const before = [...previous, element(22, 7, 'Typography', 'Welcome')]
    const after = [...shifted, element(21, 7, 'Typography', 'Welcome')]
    expect(check(icon, after, before)).toEqual({ status: 'moved', line: 13, column: 7 })
    // The heading itself moves with its neighbors.
    expect(check(edit('e6'), after, before)).toEqual({ status: 'moved', line: 11, column: 7 })
  })
})

const reading = (overrides: Partial<Reading<object>>): Reading<object> => ({
  document: {},
  elements: [],
  previous: [],
  first: false,
  current: new Set(),
  carried: new Set(),
  seen: new Set(),
  ...overrides,
})

describe('nextReading and baseOf', () => {
  const first = { id: 'first' }
  const second = { id: 'second' }
  const a = [element(12, 7, 'Typography', 'Welcome')]
  const b = [element(11, 7, 'Typography', 'Welcome')]

  test('the first reading has no elements before, and a target there is unknown', () => {
    const value = nextReading(undefined, first, a)
    expect(value).toMatchObject({ document: first, elements: a, previous: [], first: true })
    expect(baseOf(value, edit('e1'))).toBe('unknown')
  })

  test('a new document keeps the elements and the current targets of the last one', () => {
    const last = anchorWrites([{ edit: edit('e1') }], nextReading(undefined, first, a)).reading
    expect(baseOf(last, edit('e1'))).toBe('current')
    const value = nextReading(last, second, b)
    expect(value).toMatchObject({ document: second, elements: b, previous: a, first: false })
    expect(baseOf(value, edit('e1'))).toBe('previous')
  })

  test('a target that a check saw and that is not current or carried is lost after the first document', () => {
    const last = anchorWrites([{ edit: edit('e1', { label: 'Gone' }) }], nextReading(undefined, first, a)).reading
    expect(baseOf(last, edit('e1', { label: 'Gone' }))).toBe('unknown')
    expect(baseOf(nextReading(last, second, b), edit('e1'))).toBe('lost')
    // A target that no check saw is unknown.
    expect(baseOf(nextReading(last, second, b), edit('e2'))).toBe('unknown')
  })

  test('a second read of the same document keeps the bases', () => {
    const more = [...b, element(20, 5, 'Button', 'Start')]
    const last = reading({ document: second, elements: b, previous: a, carried: new Set(['x']) })
    const value = nextReading(last, second, more)
    expect(value.previous).toBe(a)
    expect(value.carried).toBe(last.carried)
    expect(value.elements).toHaveLength(2)
  })
})

describe('anchorWrites', () => {
  const elements = [element(13, 7, 'Typography', 'Welcome'), element(20, 5, 'Button', 'Start')]
  const fresh = nextReading(undefined, {}, elements)

  test('gives a move for a moved edit and nothing for an edit at its place', () => {
    const items: Item[] = [{ edit: edit('e1') }, { edit: edit('e2', { line: 20, column: 5, tag: 'Button', label: 'Start' }) }]
    const { writes, reading: after } = anchorWrites(items, fresh)
    expect(writes).toEqual([{ id: 'e1', stale: false, line: 13, column: 7 }])
    // Both places are places of this document now.
    expect(baseOf(after, edit('e1', { line: 13 }))).toBe('current')
    expect(baseOf(after, edit('e2', { line: 20, column: 5, tag: 'Button', label: 'Start' }))).toBe('current')
  })

  test('marks an edit with no match as stale, once', () => {
    const gone = edit('e1', { label: 'Gone' })
    expect(anchorWrites([{ edit: gone }], fresh).writes).toEqual([{ id: 'e1', stale: true }])
    expect(anchorWrites([{ edit: gone, stale: true }], fresh).writes).toEqual([])
  })

  test('clears the stale mark of an edit that matches again', () => {
    const items: Item[] = [{ edit: edit('e1', { line: 13 }), stale: true }, { edit: edit('e2'), stale: true }]
    expect(anchorWrites(items, fresh).writes).toEqual([
      { id: 'e1', stale: false },
      { id: 'e2', stale: false, line: 13, column: 7 },
    ])
  })

  test('a comment on an element moves with its element and goes stale as the other edits', () => {
    const comment: Change = { kind: 'comment', text: 'Make this a table.' }
    const moved = edit('c1', {}, comment)
    expect(anchorWrites([{ edit: moved }], fresh).writes).toEqual([{ id: 'c1', stale: false, line: 13, column: 7 }])
    const gone = edit('c2', { label: 'Gone' }, comment)
    expect(anchorWrites([{ edit: gone }], fresh).writes).toEqual([{ id: 'c2', stale: true }])
  })

  test('a comment on the screen gives no write and stays out of the reading', () => {
    const screenComment: Item = {
      edit: { id: 'c1', target: null, width: 390, change: { kind: 'comment', text: 'Add an empty state.' } },
    }
    const result = anchorWrites([screenComment], fresh)
    expect(result.writes).toEqual([])
    expect(result.reading.seen.size).toBe(0)
    expect(result.reading.current.size).toBe(0)
    // Also with no screen elements of the file at all, and with an item that
    // is marked stale: the check does not touch it.
    const empty = nextReading(undefined, {}, [element(1, 1, 'Box', '', 'screens/other.tsx')])
    expect(anchorWrites([{ ...screenComment, stale: true }], empty).writes).toEqual([])
  })

  test('marks a lost edit stale again after its mark was dropped', () => {
    const lost = edit('e1', { line: 13 })
    const value = reading({ elements, seen: new Set([`e1\n${file}:13:7`]) })
    expect(anchorWrites([{ edit: lost }], value).writes).toEqual([{ id: 'e1', stale: true }])
  })
})

describe('anchorScreen', () => {
  const screen = 'onboarding/welcome'
  const elements = [element(13, 7, 'Typography', 'Welcome'), element(20, 5, 'Button', 'Start')]
  const lines = (store: ReturnType<typeof createEditsStore>) =>
    store.get(screen).map((item) => [item.edit.id, item.edit.target?.line, item.stale])

  test('items at their place: nothing is written, and the preview can be applied', () => {
    const store = createEditsStore()
    store.apply(screen, edit('e1', { line: 13 }))
    const items = store.get(screen)
    expect(anchorScreen(store, screen, items, undefined, {}, elements).ready).toBe(true)
    expect(store.get(screen)).toBe(items)
  })

  test('a moved and a stale item are written, and the preview waits for the new list', () => {
    const store = createEditsStore()
    store.apply(screen, edit('e1'))
    store.apply(screen, edit('e2', { line: 30, label: 'Gone' }))
    const document = {}
    const first = anchorScreen(store, screen, store.get(screen), undefined, document, elements)
    expect(first.ready).toBe(false)
    expect(lines(store)).toEqual([
      ['e1', 13, undefined],
      ['e2', 30, true],
    ])
    // The new list is in agreement with the elements.
    expect(anchorScreen(store, screen, store.get(screen), first.reading, document, elements).ready).toBe(true)
  })

  test('a stale item that moves gets the new place and loses the stale mark', () => {
    const store = createEditsStore()
    store.apply(screen, edit('e1'))
    store.mark(screen, 'e1', true)
    expect(anchorScreen(store, screen, store.get(screen), undefined, {}, elements).ready).toBe(false)
    expect(store.get(screen)).toEqual([{ edit: edit('e1', { line: 13 }) }])
  })

  // The documents of one screen: an icon button and two dividers with a note
  // between them, between two labeled elements.
  const documentA = [
    element(10, 5, 'Stack', 'Welcome Start'),
    element(14, 7, 'IconButton', ''),
    element(16, 7, 'Divider', ''),
    element(17, 7, 'Typography', 'Note'),
    element(18, 7, 'Divider', ''),
    element(20, 7, 'Button', 'Start'),
  ]
  const up = (list: ScreenElement[], count: number) => list.map((now) => ({ ...now, line: now.line - count }))

  test('a remove edit and an edit with an empty label move with their neighbors, once', () => {
    const store = createEditsStore()
    store.apply(screen, edit('e1', { line: 14, tag: 'IconButton', label: '' }))
    store.apply(screen, edit('e2', { line: 16, tag: 'Divider', label: '' }, { kind: 'remove' }))
    const a = {}
    const b = {}
    const inA = anchorScreen(store, screen, store.get(screen), undefined, a, documentA)
    expect(inA.ready).toBe(true)
    // Two lines above the section are removed: the second divider is at the
    // old place of the first one now.
    const documentB = up(documentA, 2)
    const inB = anchorScreen(store, screen, store.get(screen), inA.reading, b, documentB)
    expect(inB.ready).toBe(false)
    expect(lines(store)).toEqual([
      ['e1', 12, undefined],
      ['e2', 14, undefined],
    ])
    // The check of the new list in the same document does not move them again.
    const again = anchorScreen(store, screen, store.get(screen), inB.reading, b, documentB)
    expect(again.ready).toBe(true)
  })

  test('an item retargeted in a document is not moved again when its element leaves the page for a short time', () => {
    const store = createEditsStore()
    store.apply(screen, edit('e2', { line: 18, tag: 'Divider', label: '' }, { kind: 'remove' }))
    const a = {}
    const b = {}
    const inA = anchorScreen(store, screen, store.get(screen), undefined, a, documentA)
    const documentB = up(documentA, 2)
    const inB = anchorScreen(store, screen, store.get(screen), inA.reading, b, documentB)
    const moved = anchorScreen(store, screen, store.get(screen), inB.reading, b, documentB)
    expect(lines(store)).toEqual([['e2', 16, undefined]])
    // A state update hides the second divider (line 16) for a short time; the
    // first divider is at line 14, two lines above it.
    const hidden = documentB.filter((now) => now.line !== 16)
    const later = anchorScreen(store, screen, store.get(screen), moved.reading, b, hidden)
    expect(lines(store)).toEqual([['e2', 16, true]])
    // It comes back: the item is at its place again.
    anchorScreen(store, screen, store.get(screen), later.reading, b, documentB)
    expect(lines(store)).toEqual([['e2', 16, undefined]])
  })

  test('a stale item from an older document stays stale after a second change of the file', () => {
    const store = createEditsStore()
    store.apply(screen, edit('e2', { line: 16, tag: 'Divider', label: '' }, { kind: 'remove' }))
    const a = {}
    const b = {}
    const c = {}
    const inA = anchorScreen(store, screen, store.get(screen), undefined, a, documentA)
    // Document B: the agent removed the first divider (two lines): the second
    // one is at line 16 now. The item is stale.
    const documentB = [
      documentA[0],
      documentA[1],
      element(15, 7, 'Typography', 'Note'),
      element(16, 7, 'Divider', ''),
      element(18, 7, 'Button', 'Start'),
    ]
    const inB = anchorScreen(store, screen, store.get(screen), inA.reading, b, documentB)
    const marked = anchorScreen(store, screen, store.get(screen), inB.reading, b, documentB)
    expect(lines(store)).toEqual([['e2', 16, true]])
    // Document C: two lines above the section are added. The shift from B to
    // C would bring the old place (line 16 of A) to line 18, where the second
    // divider is now; the item stays stale.
    const documentC = documentB.map((now) => ({ ...now, line: now.line + 2 }))
    const inC = anchorScreen(store, screen, store.get(screen), marked.reading, c, documentC)
    expect(lines(store)).toEqual([['e2', 16, true]])
    // Also after its stale mark was dropped (a new load of the request file).
    const items = store.get(screen).map((item) => item.edit)
    store.replace(screen, items)
    expect(lines(store)).toEqual([['e2', 16, undefined]])
    anchorScreen(store, screen, store.get(screen), inC.reading, c, documentC)
    expect(lines(store)).toEqual([['e2', 16, true]])
  })

  test('an item whose element renders later in the new document still moves from the document before', () => {
    const store = createEditsStore()
    store.apply(screen, edit('e1', { line: 14, tag: 'IconButton', label: '' }))
    const a = {}
    const b = {}
    const inA = anchorScreen(store, screen, store.get(screen), undefined, a, documentA)
    const documentB = up(documentA, 1)
    // The icon button is in a lazy part: not there at the first read.
    const partial = documentB.filter((now) => now.tag !== 'IconButton')
    const early = anchorScreen(store, screen, store.get(screen), inA.reading, b, partial)
    expect(lines(store)).toEqual([['e1', 14, true]])
    anchorScreen(store, screen, store.get(screen), early.reading, b, documentB)
    expect(lines(store)).toEqual([['e1', 13, undefined]])
  })

  test('a screen with no elements changes nothing and keeps the last reading', () => {
    const store = createEditsStore()
    store.apply(screen, edit('e1', { label: 'Gone' }))
    const items = store.get(screen)
    const last = nextReading(undefined, {}, elements)
    const result = anchorScreen(store, screen, items, last, {}, [])
    expect(result).toEqual({ ready: true, reading: last })
    expect(store.get(screen)).toBe(items)
  })
})
