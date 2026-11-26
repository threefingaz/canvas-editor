import { describe, expect, test } from 'vitest'
import type { Change, Edit, EditValue, Target } from '../../requests/format.ts'
import type { Token } from '../../tokens/format.ts'
import type { Item } from '../edits/model.ts'
import { previewRules, removedSelector } from './css.ts'

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

const other: Target = { ...target, line: 20, tag: 'Typography', element: 'h1' }

const bodyStyle = {
  fontFamily: 'system-ui, "Segoe UI", sans-serif',
  fontSize: '16px',
  fontWeight: '400',
  lineHeight: '24px',
  letterSpacing: '0.15px',
}

const tokens: Token[] = [
  {
    id: 'spacing.2',
    group: 'spacing',
    name: 'spacing.2',
    value: '16px',
    cssVar: '--mui-spacing',
    factor: 2,
    code: 2,
  },
  {
    id: 'palette.primary.main',
    group: 'color',
    name: 'primary.main',
    value: '#1f4fd8',
    cssVar: '--mui-palette-primary-main',
    code: 'primary.main',
  },
  {
    id: 'typography.body1',
    group: 'textStyle',
    name: 'body1',
    value: bodyStyle,
    cssVar: '--mui-font-body1',
    code: 'body1',
  },
  { id: 'typography.plain', group: 'textStyle', name: 'plain', value: bodyStyle, code: 'plain' },
]

const px = (value: string): EditValue => ({ value, observed: true })
const linked = (id: string, value: string): EditValue => ({ value, token: { id, name: id, code: id } })

function edit(id: string, change: Change, at: Target = target): Edit {
  return { id, target: at, width: 390, change }
}

function style(id: string, properties: string[], after: EditValue, at = target): Item {
  return { edit: edit(id, { kind: 'style', properties, before: px('20px'), after }, at) }
}

function textStyle(id: string, after: EditValue, at = other): Item {
  return { edit: edit(id, { kind: 'textStyle', before: px('16px'), after }, at) }
}

const remove = (id: string, at = target): Item => ({ edit: edit(id, { kind: 'remove' }, at) })

describe('previewRules', () => {
  test('gives one rule for a style edit, with each property and !important', () => {
    const items = [style('e1', ['padding-top', 'padding-bottom'], linked('spacing.2', '16px'))]
    expect(previewRules(items, tokens)).toEqual({
      rules: [
        '[data-canvas-edit~="e1"] { padding-top: calc(2 * var(--mui-spacing)) !important; ' +
          'padding-bottom: calc(2 * var(--mui-spacing)) !important }',
      ],
      problems: [],
    })
  })

  test('takes the value from the token in the list, not from the edit', () => {
    const items = [style('e1', ['color'], linked('palette.primary.main', 'red'))]
    expect(previewRules(items, tokens).rules).toEqual([
      '[data-canvas-edit~="e1"] { color: var(--mui-palette-primary-main) !important }',
    ])
  })

  test('gives one rule for each style edit', () => {
    const items = [
      style('e1', ['padding-top'], linked('spacing.2', '16px')),
      style('e2', ['color'], linked('palette.primary.main', '#1f4fd8'), other),
    ]
    expect(previewRules(items, tokens).rules).toHaveLength(2)
  })

  test('uses the value of a style edit with no token: a layout keyword', () => {
    const items = [style('e1', ['flex-direction'], { value: 'column' })]
    expect(previewRules(items, tokens).rules).toEqual([
      '[data-canvas-edit~="e1"] { flex-direction: column !important }',
    ])
  })

  test('a token id that is not in the list gives no rule and a problem', () => {
    const items = [
      style('e1', ['padding-top'], linked('spacing.9', '72px')),
      style('e2', ['color'], linked('palette.primary.main', '#1f4fd8')),
    ]
    const result = previewRules(items, tokens)
    expect(result.rules).toHaveLength(1)
    expect(result.rules[0]).toContain('"e2"')
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toMatch(/"e1".*spacing\.9/)
  })

  test('a text style edit with a variable gives font and letter-spacing', () => {
    const items = [textStyle('e1', linked('typography.body1', 'body1'))]
    expect(previewRules(items, tokens).rules).toEqual([
      '[data-canvas-edit~="e1"] { font: var(--mui-font-body1) !important; ' +
        'letter-spacing: 0.15px !important; --canvas-preview-text-style: initial !important }',
    ])
  })

  test('a style edit of the mark of a text style is refused: a request cannot write CSS', () => {
    const items = [
      style('e1', ['--canvas-preview-text-style'], { value: '"x" } body { display: none } a { b: "' }),
      style('e2', ['--canvas-preview-text-style'], { value: '"typography.plain"' }),
    ]
    const result = previewRules(items, tokens)
    expect(result.rules).toEqual([])
    expect(result.problems).toHaveLength(2)
  })

  test('a text style edit with no variable gives the five font properties', () => {
    const items = [textStyle('e1', linked('typography.plain', 'plain'))]
    expect(previewRules(items, tokens).rules).toEqual([
      '[data-canvas-edit~="e1"] { font-family: system-ui, "Segoe UI", sans-serif !important; ' +
        'font-size: 16px !important; font-weight: 400 !important; line-height: 24px !important; ' +
        'letter-spacing: 0.15px !important; --canvas-preview-text-style: "typography.plain" !important }',
    ])
  })

  test('a text style edit with no token or with a token of a different group gives a problem', () => {
    const items = [
      textStyle('e1', px('16px')),
      textStyle('e2', linked('spacing.2', '16px')),
      style('e3', ['color'], linked('typography.body1', 'body1')),
    ]
    const result = previewRules(items, tokens)
    expect(result.rules).toEqual([])
    expect(result.problems).toHaveLength(3)
    expect(result.problems[0]).toMatch(/"e1"/)
    expect(result.problems[1]).toMatch(/"e2".*spacing\.2/)
    expect(result.problems[2]).toMatch(/"e3".*typography\.body1/)
  })

  test('remove gives display none, and the other edits of that target give no rule', () => {
    const items = [
      style('e1', ['padding-top'], linked('spacing.2', '16px')),
      style('e2', ['color'], linked('palette.primary.main', '#1f4fd8'), other),
      remove('e3'),
    ]
    expect(previewRules(items, tokens).rules).toEqual([
      '[data-canvas-edit~="e2"] { color: var(--mui-palette-primary-main) !important }',
      '[data-canvas-edit~="e3"] { display: none !important }',
    ])
  })

  test('a text edit and an order edit give no rule here', () => {
    const items: Item[] = [
      { edit: edit('e1', { kind: 'text', before: 'Welcome', after: 'Hello' }) },
      { edit: edit('e2', { kind: 'order', before: 2, after: 1, of: 3, previewed: true }) },
    ]
    expect(previewRules(items, tokens)).toEqual({ rules: [], problems: [] })
  })

  test('an item with a reply or with stale gives no rule', () => {
    const replied: Item = {
      edit: {
        ...style('e1', ['color'], linked('palette.primary.main', '#1f4fd8')).edit,
        reply: { status: 'conflict', text: 'The color is set in the theme.' },
      },
    }
    const stale: Item = { ...style('e2', ['padding-top'], linked('spacing.2', '16px')), stale: true }
    expect(previewRules([replied, stale], tokens)).toEqual({ rules: [], problems: [] })
  })

  test('a remove edit with a reply or with stale hides nothing', () => {
    const replied: Item = {
      edit: { ...remove('e2').edit, reply: { status: 'unclear', text: 'Which card?' } },
    }
    const stale: Item = { ...remove('e3'), stale: true }
    const items = [style('e1', ['padding-top'], linked('spacing.2', '16px')), replied, stale]
    const rules = previewRules(items, tokens).rules
    expect(rules).toHaveLength(1)
    expect(rules[0]).toContain('"e1"')
  })

  test('escapes the id in the selector', () => {
    const items = [remove('a"b\\c\nd')]
    expect(previewRules(items, tokens).rules).toEqual([
      '[data-canvas-edit~="a\\"b\\\\c\\a d"] { display: none !important }',
    ])
  })

  test('a property or a value that could end the rule gives a problem', () => {
    const items = [
      style('e1', ['color; background: red'], linked('palette.primary.main', '#1f4fd8')),
      style('e2', ['flex-direction'], { value: 'row } body { display: none' }),
    ]
    const result = previewRules(items, tokens)
    expect(result.rules).toEqual([])
    expect(result.problems).toHaveLength(2)
  })

  test('a value that opens a comment, has a backslash, a line break, a quote or a bracket with no end gives a problem', () => {
    const values = ['red /*', 'red */', 'red\\9', 'red\nblue', '"Roboto', "'Roboto", `"'"'`, 'calc(16px', 'calc(16px))', 'a[1', 'a(]', '8px !important']
    const items = values.map((value, index) => style(`e${index}`, ['color'], { value }))
    const result = previewRules(items, tokens)
    expect(result.rules).toEqual([])
    expect(result.problems).toHaveLength(values.length)
  })

  test('a value with quotes in pairs is valid', () => {
    const items = [
      style('e1', ['font-family'], { value: '"Segoe UI", \'Roboto\', sans-serif' }),
      style('e2', ['font-family'], { value: '"O\'Brien", sans-serif' }),
      style('e3', ['padding-top'], { value: 'calc(var(--gap, 8px) * 2)' }),
      style('e4', ['content'], { value: '"(" attr(title) "]"' }),
      style('e5', ['content'], { value: '"Hi!"' }),
    ]
    expect(previewRules(items, tokens).problems).toEqual([])
  })
})

describe('removedSelector', () => {
  test('one selector for each remove edit, by its id', () => {
    const items = [remove('e1'), style('e2', ['padding-top'], linked('spacing.2', '16px')), remove('e3', other)]
    expect(removedSelector(items)).toBe('[data-canvas-edit~="e1"], [data-canvas-edit~="e3"]')
  })

  test('null when no edit removes an element', () => {
    expect(removedSelector([style('e1', ['padding-top'], linked('spacing.2', '16px'))])).toBeNull()
    expect(removedSelector([])).toBeNull()
  })

  test('a remove edit with a reply or with stale hides nothing', () => {
    const replied: Item = { edit: { ...remove('e1').edit, reply: { status: 'unclear', text: 'Which card?' } } }
    expect(removedSelector([replied, { ...remove('e2'), stale: true }])).toBeNull()
  })

  test('escapes the id', () => {
    expect(removedSelector([remove('a"b')])).toBe('[data-canvas-edit~="a\\"b"]')
  })
})
