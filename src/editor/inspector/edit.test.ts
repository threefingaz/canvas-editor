import { describe, expect, test } from 'vitest'
import { commentLimit, optionCounts, type Change, type Target } from '../../requests/format.ts'
import type { TextStyle, Token } from '../../tokens/format.ts'
import type { Item } from '../edits/model.ts'
import type { Site } from '../locate/fiber.ts'
import type { Siblings } from '../selection/pick.ts'
import {
  activeToken,
  stepName,
  commentEdit,
  commentText,
  controlOf,
  keepEdit,
  layoutEdit,
  layoutKeywords,
  movePlan,
  newEditId,
  optionCount,
  optionsEdit,
  orderEdit,
  rowAction,
  removeEdit,
  rowEdit,
  styleEdit,
  targetOf,
  textEdit,
  textEditable,
  textStyleEdit,
} from './edit.ts'
import type { InspectorRow } from './model.ts'

function spacing(factor: number): Token {
  return {
    id: `spacing.${factor}`,
    group: 'spacing',
    name: `spacing.${factor}`,
    value: `${factor * 8}px`,
    cssVar: '--mui-spacing',
    factor,
    code: factor,
  }
}
const primary: Token = {
  id: 'palette.primary.main',
  group: 'color',
  name: 'primary.main',
  value: '#1f4fd8',
  cssVar: '--mui-palette-primary-main',
  code: 'primary.main',
}
const secondary: Token = {
  id: 'palette.secondary.main',
  group: 'color',
  name: 'secondary.main',
  value: '#6941c6',
  cssVar: '--mui-palette-secondary-main',
  code: 'secondary.main',
}

const steps = [spacing(1), spacing(2), spacing(4)]

function textStyle(name: string, fontSize: string, lineHeight: string, fontWeight: string): Token {
  const value: TextStyle = { fontFamily: 'system-ui', fontSize, fontWeight, lineHeight, letterSpacing: '0px' }
  return { id: `typography.${name}`, group: 'textStyle', name, value, cssVar: `--mui-font-${name}`, code: name }
}
const body1 = textStyle('body1', '16px', '24px', '400')
const button = textStyle('button', '14px', '24.5px', '500')
const textStyles = [body1, button]

function textStyleRow(state: InspectorRow['state'], value = '16px / 24px · 400'): InspectorRow {
  return {
    label: 'Text style',
    value,
    group: 'textStyle',
    state,
    missing: state?.state !== 'linked',
    properties: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'],
    tokens: textStyles,
  }
}

function paddingRow(state: InspectorRow['state'], value = '16px', extra: Partial<InspectorRow> = {}): InspectorRow {
  return {
    label: 'Padding',
    value,
    group: 'spacing',
    state,
    missing: state?.state !== 'linked',
    properties: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
    tokens: steps,
    ...extra,
  }
}

const site: Site = {
  loc: 'screens/onboarding/welcome.tsx:12:7',
  file: 'screens/onboarding/welcome.tsx',
  line: 12,
  column: 7,
  tag: 'CardContent',
  origin: 'library',
}

const target: Target = {
  file: 'screens/onboarding/welcome.tsx',
  line: 12,
  column: 7,
  tag: 'CardContent',
  origin: 'library',
  element: 'div',
  copies: 1,
  label: 'Welcome',
}

describe('targetOf', () => {
  test('takes the place and the tag from the site', () => {
    expect(targetOf(site, 'div', 1, 'Welcome')).toEqual(target)
  })

  test('the label is cut and has one space for each run of white space', () => {
    const result = targetOf({ ...site, tag: 'Stack' }, 'div', 3, ` Get\n started ${'x'.repeat(100)}`)
    expect(result.tag).toBe('Stack')
    expect(result.copies).toBe(3)
    expect(result.label.startsWith('Get started x')).toBe(true)
    expect(result.label.length).toBe(80)
  })
})

describe('activeToken', () => {
  test('the token of a linked or equal value, the nearest token of a value with no token', () => {
    expect(activeToken(paddingRow({ state: 'linked', token: spacing(2) }))).toEqual(spacing(2))
    expect(activeToken(paddingRow({ state: 'equal', token: spacing(4) }))).toEqual(spacing(4))
    expect(activeToken(paddingRow({ state: 'none', nearest: spacing(1) }, '13px'))).toEqual(spacing(1))
  })

  test('null for a value with no state or no nearest token', () => {
    expect(activeToken(paddingRow(null))).toBeNull()
    expect(activeToken(paddingRow({ state: 'none', nearest: null }, '13px'))).toBeNull()
  })
})

describe('stepName', () => {
  const tokens = [{ name: 'spacing.1' }, { name: 'spacing.2' }, { name: 'spacing.3' }]

  test('a step other than the starting one names its token', () => {
    expect(stepName(tokens, 2, 0)).toBe('spacing.3')
  })

  test('the starting step names nothing: the line of the value names it', () => {
    expect(stepName(tokens, 1, 1)).toBeUndefined()
  })

  test('a value with no nearest token names each step it is moved to, the first one too', () => {
    expect(stepName(tokens, 0, null)).toBe('spacing.1')
  })

  test('no step names nothing', () => {
    expect(stepName(tokens, null, null)).toBeUndefined()
    expect(stepName(tokens, null, 1)).toBeUndefined()
  })
})

describe('controlOf', () => {
  const linked = paddingRow({ state: 'linked', token: spacing(2) })

  test('a step control for spacing, radius and shadow; a select for color', () => {
    expect(controlOf(linked)).toBe('step')
    expect(controlOf({ ...linked, group: 'radius' })).toBe('step')
    expect(controlOf({ ...linked, group: 'shadow' })).toBe('step')
    expect(controlOf({ ...linked, group: 'color', state: { state: 'none', nearest: primary }, tokens: [primary] })).toBe(
      'color',
    )
  })

  test('a select for the text style', () => {
    expect(controlOf(textStyleRow({ state: 'linked', token: body1 }))).toBe('textStyle')
    expect(controlOf(textStyleRow({ state: 'none', nearest: body1 }, '15px / 21.75px · 500'))).toBe('textStyle')
  })

  test('read-only: no tokens, one step, no state, a negative value, a layout value', () => {
    expect(controlOf({ ...linked, tokens: [] })).toBeNull()
    expect(controlOf({ ...linked, tokens: [spacing(2)] })).toBeNull()
    expect(controlOf(paddingRow(null))).toBeNull()
    expect(controlOf(paddingRow({ state: 'linked', token: spacing(2), negative: true }, '-16px'))).toBeNull()
    expect(controlOf({ ...linked, group: null })).toBeNull()
    expect(controlOf({ ...textStyleRow({ state: 'linked', token: body1 }), tokens: [] })).toBeNull()
    expect(controlOf(textStyleRow(null))).toBeNull()
  })
})

describe('newEditId', () => {
  test('gives a different short id each time', () => {
    const a = newEditId()
    const b = newEditId()
    expect(a).toMatch(/^[0-9a-f]{12}$/)
    expect(a).not.toBe(b)
  })
})

describe('styleEdit', () => {
  test('a linked value: before has the token, after has the new token', () => {
    const edit = styleEdit(paddingRow({ state: 'linked', token: spacing(2) }), spacing(4), target, 390, 'e1')
    expect(edit).toEqual({
      id: 'e1',
      target,
      width: 390,
      change: {
        kind: 'style',
        properties: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
        before: { value: '16px', token: { id: 'spacing.2', name: 'spacing.2', code: 2 } },
        after: { value: '32px', token: { id: 'spacing.4', name: 'spacing.4', code: 4 } },
      },
    })
  })

  test('a value with no token link is observed, with no token', () => {
    const equal = styleEdit(paddingRow({ state: 'equal', token: spacing(2) }), spacing(4), target, 390, 'e1')
    expect(equal?.change).toMatchObject({ before: { value: '16px', observed: true } })
    expect(equal?.change.kind === 'style' && equal.change.before.token).toBeUndefined()
    const none = styleEdit(paddingRow({ state: 'none', nearest: spacing(1) }, '13px'), spacing(1), target, 390, 'e2')
    expect(none?.change).toMatchObject({ before: { value: '13px', observed: true }, after: { value: '8px' } })
  })

  test('the media condition of the row goes with the edit', () => {
    const row = paddingRow({ state: 'linked', token: spacing(2) }, '16px', { media: '(min-width: 600px)' })
    const edit = styleEdit(row, spacing(1), target, 1280, 'e1')
    expect(edit?.change).toMatchObject({ kind: 'style', media: '(min-width: 600px)' })
    expect(edit?.width).toBe(1280)
    const plain = styleEdit(paddingRow({ state: 'linked', token: spacing(2) }), spacing(1), target, 390, 'e2')
    expect(plain?.change).not.toHaveProperty('media')
  })

  test('a color: an opaque color keeps its hex text, a color with opacity gives its computed value; after has the form of before', () => {
    const fill: InspectorRow = {
      label: 'Fill',
      value: '#1F4FD8',
      group: 'color',
      state: { state: 'linked', token: primary },
      swatch: 'rgb(31, 79, 216)',
      missing: false,
      properties: ['background-color'],
      tokens: [primary, secondary],
    }
    const edit = styleEdit(fill, secondary, target, 390, 'e1')
    expect(edit?.change).toEqual({
      kind: 'style',
      properties: ['background-color'],
      before: { value: '#1F4FD8', token: { id: 'palette.primary.main', name: 'primary.main', code: 'primary.main' } },
      after: { value: '#6941C6', token: { id: 'palette.secondary.main', name: 'secondary.main', code: 'secondary.main' } },
    })
    const faded = { ...fill, value: '#000000 60%', swatch: 'rgba(0, 0, 0, 0.6)', state: { state: 'none' as const, nearest: primary } }
    expect(styleEdit(faded, primary, target, 390, 'e2')?.change).toMatchObject({
      before: { value: 'rgba(0, 0, 0, 0.6)', observed: true },
    })
    const scrim: Token = { ...secondary, id: 'palette.scrim', value: 'rgba(0, 0, 0, 0.5)' }
    expect(styleEdit(fill, scrim, target, 390, 'e3')?.change).toMatchObject({ after: { value: 'rgba(0, 0, 0, 0.5)' } })
  })

  test('a new id when none is given', () => {
    const edit = styleEdit(paddingRow({ state: 'linked', token: spacing(2) }), spacing(4), target, 390)
    expect(edit?.id).toMatch(/^[0-9a-f]{12}$/)
  })

  test('no edit for a token of a different group, a row with no state, a layout row, or a negative value', () => {
    const linked = paddingRow({ state: 'linked', token: spacing(2) })
    expect(styleEdit(linked, primary, target, 390)).toBeNull()
    expect(styleEdit(paddingRow(null), spacing(1), target, 390)).toBeNull()
    expect(styleEdit({ ...linked, group: null, state: null, tokens: [] }, spacing(1), target, 390)).toBeNull()
    const negative = paddingRow({ state: 'linked', token: spacing(2), negative: true }, '-16px')
    expect(styleEdit(negative, spacing(1), target, 390)).toBeNull()
  })

  test('no edit for a text style token: a text style has its own edit', () => {
    const body1: Token = { ...spacing(1), id: 'typography.body1', group: 'textStyle' }
    const row: InspectorRow = { ...paddingRow({ state: 'linked', token: body1 }), group: 'textStyle', tokens: [body1] }
    expect(styleEdit(row, body1, target, 390)).toBeNull()
  })
})

describe('textStyleEdit', () => {
  test('a linked text style: before has its token, after has the new style', () => {
    const edit = textStyleEdit(textStyleRow({ state: 'linked', token: body1 }), button, target, 390, 'e1')
    expect(edit).toEqual({
      id: 'e1',
      target,
      width: 390,
      change: {
        kind: 'textStyle',
        before: { value: '16px / 24px · 400', token: { id: 'typography.body1', name: 'body1', code: 'body1' } },
        after: { value: '14px / 24.5px · 500', token: { id: 'typography.button', name: 'button', code: 'button' } },
      },
    })
  })

  test('a text style with no link is observed', () => {
    const row = textStyleRow({ state: 'none', nearest: button }, '15px / 21.75px · 500')
    expect(textStyleEdit(row, button, target, 390, 'e1')?.change).toEqual({
      kind: 'textStyle',
      before: { value: '15px / 21.75px · 500', observed: true },
      after: { value: '14px / 24.5px · 500', token: { id: 'typography.button', name: 'button', code: 'button' } },
    })
  })

  test('no edit for a token that is not a text style, a row of a different group, or a row with no state', () => {
    expect(textStyleEdit(textStyleRow({ state: 'linked', token: body1 }), spacing(2), target, 390)).toBeNull()
    expect(textStyleEdit(paddingRow({ state: 'linked', token: spacing(2) }), body1, target, 390)).toBeNull()
    expect(textStyleEdit(textStyleRow(null), body1, target, 390)).toBeNull()
  })
})

describe('rowEdit', () => {
  test('a text style row gives a text style edit, any other row a style edit', () => {
    expect(rowEdit(textStyleRow({ state: 'linked', token: body1 }), button, target, 390)?.change.kind).toBe('textStyle')
    expect(rowEdit(paddingRow({ state: 'linked', token: spacing(2) }), spacing(4), target, 390)?.change.kind).toBe(
      'style',
    )
  })
})

describe('rowEdit for the row actions', () => {
  test('Link: an equal value gives the same value with its token', () => {
    const edit = rowEdit(paddingRow({ state: 'equal', token: spacing(2) }), spacing(2), target, 390, 'e1')
    expect(edit?.change).toEqual({
      kind: 'style',
      properties: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
      before: { value: '16px', observed: true },
      after: { value: '16px', token: { id: 'spacing.2', name: 'spacing.2', code: 2 } },
    })
  })

  test('Link: an equal text style is linked to its style', () => {
    const edit = rowEdit(textStyleRow({ state: 'equal', token: body1 }), body1, target, 390, 'e1')
    expect(edit?.change).toEqual({
      kind: 'textStyle',
      before: { value: '16px / 24px · 400', observed: true },
      after: { value: '16px / 24px · 400', token: { id: 'typography.body1', name: 'body1', code: 'body1' } },
    })
  })

  test('Use nearest: a value with no token gets the nearest token', () => {
    const edit = rowEdit(paddingRow({ state: 'none', nearest: spacing(1) }, '13px'), spacing(1), target, 390, 'e1')
    expect(edit?.change).toEqual({
      kind: 'style',
      properties: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
      before: { value: '13px', observed: true },
      after: { value: '8px', token: { id: 'spacing.1', name: 'spacing.1', code: 1 } },
    })
  })

  test('Use nearest: a text style with no token gets the nearest style', () => {
    const row = textStyleRow({ state: 'none', nearest: button }, '15px / 21.75px · 500')
    expect(rowEdit(row, button, target, 390, 'e1')?.change).toMatchObject({
      kind: 'textStyle',
      after: { token: { id: 'typography.button' } },
    })
  })
})

describe('rowAction', () => {
  test('link for an equal value, use nearest for a value with a nearest token', () => {
    expect(rowAction(paddingRow({ state: 'equal', token: spacing(2) }))).toBe('link')
    expect(rowAction(textStyleRow({ state: 'equal', token: body1 }))).toBe('link')
    expect(rowAction(paddingRow({ state: 'none', nearest: spacing(1) }, '13px'))).toBe('nearest')
  })

  test('none for a linked value, no nearest token, a negative value, or a layout value', () => {
    expect(rowAction(paddingRow({ state: 'linked', token: spacing(2) }))).toBeNull()
    expect(rowAction(paddingRow({ state: 'none', nearest: null }, '13px'))).toBeNull()
    expect(rowAction(paddingRow({ state: 'equal', token: spacing(2), negative: true }, '-16px'))).toBeNull()
    expect(rowAction(paddingRow(null))).toBeNull()
  })
})

describe('layoutEdit', () => {
  test('a keyword value gives a style edit of the property, with the value of the page as before', () => {
    expect(layoutEdit('flex-direction', 'row', 'column', target, 1440, undefined, 'e1')).toEqual({
      id: 'e1',
      target,
      width: 1440,
      change: {
        kind: 'style',
        properties: ['flex-direction'],
        before: { value: 'row', observed: true },
        after: { value: 'column' },
      },
    })
  })

  test('keeps the media condition of the value', () => {
    const edit = layoutEdit('align-items', 'normal', 'center', target, 1440, '(min-width:900px)', 'e1')
    expect(edit?.change).toMatchObject({ properties: ['align-items'], media: '(min-width:900px)' })
  })

  test('each property accepts its keywords', () => {
    for (const [property, keywords] of Object.entries(layoutKeywords)) {
      for (const keyword of keywords) {
        expect(layoutEdit(property, 'initial', keyword, target, 390)).not.toBeNull()
      }
    }
  })

  test('no edit for an equal value, a value that is not a keyword of the property, or a different property', () => {
    expect(layoutEdit('flex-direction', 'row', 'row', target, 390)).toBeNull()
    expect(layoutEdit('flex-direction', 'row', 'center', target, 390)).toBeNull()
    expect(layoutEdit('flex-direction', 'row', 'red; color: red', target, 390)).toBeNull()
    expect(layoutEdit('display', 'block', 'flex', target, 390)).toBeNull()
  })
})

describe('orderEdit', () => {
  test('a move gives an order edit with the positions and the count', () => {
    expect(orderEdit(2, 1, 4, true, target, 1440, 'e1')).toEqual({
      id: 'e1',
      target,
      width: 1440,
      change: { kind: 'order', before: 2, after: 1, of: 4, previewed: true },
    })
    expect(orderEdit(0, 1, 2, false, target, 1440, 'e1')?.change).toEqual({
      kind: 'order',
      before: 0,
      after: 1,
      of: 2,
      previewed: false,
    })
  })

  test('a move before the first place or after the last place gives no edit', () => {
    expect(orderEdit(0, -1, 3, true, target, 390)).toBeNull()
    expect(orderEdit(2, 3, 3, true, target, 390)).toBeNull()
  })

  test('no edit for the same place or a position outside the count', () => {
    expect(orderEdit(1, 1, 3, true, target, 390)).toBeNull()
    expect(orderEdit(3, 2, 3, true, target, 390)).toBeNull()
    expect(orderEdit(1, 0, 1, true, target, 390)).toBeNull()
  })
})

describe('textEdit', () => {
  test('a new text gives a text edit', () => {
    expect(textEdit('Welcome', 'Hello', target, 1440, 'e1')).toEqual({
      id: 'e1',
      target,
      width: 1440,
      change: { kind: 'text', before: 'Welcome', after: 'Hello' },
    })
  })

  test('the text is trimmed at the ends', () => {
    expect(textEdit(' Welcome\n', '  Hello there \t', target, 390, 'e1')?.change).toEqual({
      kind: 'text',
      before: 'Welcome',
      after: 'Hello there',
    })
  })

  test('an equal text gives no edit, also after the trim', () => {
    expect(textEdit('Welcome', 'Welcome', target, 390)).toBeNull()
    expect(textEdit('Welcome', '  Welcome ', target, 390)).toBeNull()
  })

  test('an empty text gives no edit: a removal is a remove edit', () => {
    expect(textEdit('Welcome', '', target, 390)).toBeNull()
    expect(textEdit('Welcome', '   ', target, 390)).toBeNull()
  })
})

describe('removeEdit', () => {
  test('gives a remove edit of the target', () => {
    expect(removeEdit(target, 390, 'e1')).toEqual({ id: 'e1', target, width: 390, change: { kind: 'remove' } })
  })

  test('a new edit gets a new id', () => {
    expect(removeEdit(target, 390).id).not.toBe(removeEdit(target, 390).id)
  })
})

describe('commentText', () => {
  test('a normal text stays, trimmed at the ends; lines inside stay', () => {
    expect(commentText('Make this a table')).toBe('Make this a table')
    expect(commentText('  Make this a table\n\nwith three columns \n')).toBe('Make this a table\n\nwith three columns')
  })

  test('null for an empty text and for spaces only', () => {
    expect(commentText('')).toBeNull()
    expect(commentText('   \n\t ')).toBeNull()
  })

  test('the limit: the most characters stay, one more gives null', () => {
    expect(commentText('a'.repeat(commentLimit))).toBe('a'.repeat(commentLimit))
    expect(commentText(`  ${'a'.repeat(commentLimit)}  `)).toBe('a'.repeat(commentLimit))
    expect(commentText('a'.repeat(commentLimit + 1))).toBeNull()
  })
})

describe('commentEdit', () => {
  test('gives a comment on the target with the text', () => {
    expect(commentEdit(target, 1440, 'Make this a table', 'e1')).toEqual({
      id: 'e1',
      target,
      width: 1440,
      change: { kind: 'comment', text: 'Make this a table' },
    })
  })

  test('the target null gives a comment on the screen', () => {
    expect(commentEdit(null, 1440, 'Add a state for an empty list', 'e2')).toEqual({
      id: 'e2',
      target: null,
      width: 1440,
      change: { kind: 'comment', text: 'Add a state for an empty list' },
    })
  })

  test('a new comment gets a new id', () => {
    expect(commentEdit(target, 390, 'A').id).not.toBe(commentEdit(target, 390, 'A').id)
  })
})

describe('optionCount', () => {
  test('a whole number in the range stays', () => {
    expect(optionCount('2')).toBe(2)
    expect(optionCount(' 4 ')).toBe(4)
    expect(optionCount(String(optionCounts.max))).toBe(optionCounts.max)
  })

  test('a number outside the range goes to the nearest end', () => {
    expect(optionCount('1')).toBe(optionCounts.min)
    expect(optionCount('-3')).toBe(optionCounts.min)
    expect(optionCount('7')).toBe(optionCounts.max)
    expect(optionCount('100')).toBe(optionCounts.max)
  })

  test('a fraction goes to the nearest whole number', () => {
    expect(optionCount('3.4')).toBe(3)
    expect(optionCount('4.6')).toBe(5)
  })

  test('a text that is not a number gives the count at first', () => {
    expect(optionCount('')).toBe(optionCounts.initial)
    expect(optionCount('  ')).toBe(optionCounts.initial)
    expect(optionCount('three')).toBe(optionCounts.initial)
    expect(optionCount('3x')).toBe(optionCounts.initial)
    expect(optionCount('Infinity')).toBe(optionCounts.initial)
  })
})

describe('optionsEdit', () => {
  test('gives a request for options of the target with the trimmed note', () => {
    expect(optionsEdit(target, 1440, 3, '  Fewer fields  ', 'e1')).toEqual({
      id: 'e1',
      target,
      width: 1440,
      change: { kind: 'options', count: 3, note: 'Fewer fields' },
    })
  })

  test('the target null gives a request for options of the screen; the note can be empty', () => {
    expect(optionsEdit(null, 390, optionCounts.min, '   ', 'e2')).toEqual({
      id: 'e2',
      target: null,
      width: 390,
      change: { kind: 'options', count: optionCounts.min, note: '' },
    })
  })

  test('null for a count outside the range or not whole', () => {
    expect(optionsEdit(target, 1440, optionCounts.min - 1, '')).toBeNull()
    expect(optionsEdit(target, 1440, optionCounts.max + 1, '')).toBeNull()
    expect(optionsEdit(target, 1440, 2.5, '')).toBeNull()
    expect(optionsEdit(target, 1440, Number.NaN, '')).toBeNull()
  })

  test('the note can have commentLimit characters after the trim, not more', () => {
    expect(optionsEdit(target, 1440, 3, ` ${'a'.repeat(commentLimit)} `)?.change).toEqual({
      kind: 'options',
      count: 3,
      note: 'a'.repeat(commentLimit),
    })
    expect(optionsEdit(target, 1440, 3, 'a'.repeat(commentLimit + 1))).toBeNull()
  })

  test('a new request gets a new id', () => {
    expect(optionsEdit(null, 390, 3, '')?.id).not.toBe(optionsEdit(null, 390, 3, '')?.id)
  })
})

describe('keepEdit', () => {
  test('a keep with the target null and the width of the base', () => {
    expect(keepEdit(1440, 'onboarding/welcome-option-2', 'k1')).toEqual({
      id: 'k1',
      target: null,
      width: 1440,
      change: { kind: 'keep', option: 'onboarding/welcome-option-2' },
    })
  })

  test('a new id for each edit', () => {
    expect(keepEdit(1440, 'a').id).not.toBe(keepEdit(1440, 'a').id)
  })
})

describe('textEditable', () => {
  test('true for one copy with one text node', () => {
    expect(textEditable(['Welcome'])).toBe(true)
  })

  test('true for copies that all have the same text', () => {
    expect(textEditable(['Open', 'Open', 'Open'])).toBe(true)
  })

  test('false for copies with different texts', () => {
    expect(textEditable(['Real components', 'Design tokens', 'Code first'])).toBe(false)
  })

  test('false for an element with no text node or more than one (null), and for no copies', () => {
    expect(textEditable([null])).toBe(false)
    expect(textEditable(['Open', null])).toBe(false)
    expect(textEditable([])).toBe(false)
  })
})

describe('movePlan', () => {
  const at = (line: number): Target => ({ ...target, line })
  const loc = (line: number) => `screens/onboarding/welcome.tsx:${line}:7`
  const siblings: Siblings = { position: 1, count: 3, container: 'flex', movable: true }
  const order = (id: string, line: number, after: number, extra: Partial<Item> = {}): Item => {
    const change: Change = { kind: 'order', before: 1, after, of: 3, previewed: true }
    return { edit: { id, target: at(line), width: 390, change }, ...extra }
  }
  // The places at the lines 12 to 14 are children of the parent.
  const inParent = (place: string) => [loc(12), loc(13), loc(14)].includes(place)
  const reply = { status: 'conflict' as const, text: 'The code changed' }

  test('null when the element cannot move', () => {
    expect(movePlan(loc(13), null, [], inParent)).toBeNull()
    expect(movePlan(loc(13), { ...siblings, movable: false }, [], inParent)).toBeNull()
  })

  test('the position in the code with no order edit; previewed in a flex or grid parent', () => {
    expect(movePlan(loc(13), siblings, [], inParent)).toEqual({ position: 1, count: 3, previewed: true, replaced: [] })
    expect(movePlan(loc(13), { ...siblings, container: null }, [], inParent)?.previewed).toBe(false)
  })

  test('the previewed position of the live order edit of the element', () => {
    expect(movePlan(loc(13), siblings, [order('e1', 13, 2)], inParent)?.position).toBe(2)
  })

  test('an own order edit with a reply or stale has no preview: the position in the code', () => {
    expect(movePlan(loc(13), siblings, [order('e1', 13, 2, { stale: true })], inParent)?.position).toBe(1)
    const replied = order('e1', 13, 2)
    replied.edit.reply = reply
    expect(movePlan(loc(13), siblings, [replied], inParent)?.position).toBe(1)
  })

  test('replaces the order edits of the siblings, also with a reply or stale, not of other parents', () => {
    const replied = order('e2', 14, 0)
    replied.edit.reply = reply
    const items = [order('e1', 12, 1), replied, order('e3', 14, 2, { stale: true }), order('e4', 30, 0), order('e5', 13, 0)]
    expect(movePlan(loc(13), siblings, items, inParent)?.replaced).toEqual(['e1', 'e2', 'e3'])
  })
})
