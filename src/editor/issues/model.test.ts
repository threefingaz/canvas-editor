import { describe, expect, test } from 'vitest'
import { parseIssues, type Issue, type Target } from '../../requests/format.ts'
import type { Token } from '../../tokens/format.ts'
import type { InspectorRow } from '../inspector/model.ts'
import { issueGroups, issueSummary, overflowText, rowIsSet, rowProperty, screenIssues, type IssueElement } from './model.ts'

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

function target(line: number, column: number, fields: Partial<Target> = {}): Target {
  return {
    file: 'screens/onboarding/welcome.tsx',
    line,
    column,
    tag: 'Box',
    origin: 'library',
    element: 'div',
    copies: 1,
    label: '',
    ...fields,
  }
}

function row(label: string, properties: string[], fields: Partial<InspectorRow> = {}): InspectorRow {
  return {
    label,
    value: '16px',
    group: 'spacing',
    state: { state: 'linked', token: spacing(2) },
    properties,
    tokens: [spacing(1), spacing(2)],
    missing: false,
    ...fields,
  }
}

const gap = ['row-gap', 'column-gap']
const padding = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']

describe('screenIssues', () => {
  test('a row with no token link gives no-token, with the token that it is equal to or near to', () => {
    const chips = target(51, 11, { tag: 'Stack' })
    const note = target(68, 15, { tag: 'Typography', element: 'span', label: 'No card needed.' })
    const issues = screenIssues(
      [
        { target: chips, set: true, rows: [row('Gap', gap, { missing: true, state: { state: 'equal', token: spacing(2) } })], links: [] },
        {
          target: note,
          links: [],
          rows: [
            row('Padding top', ['padding-top'], {
              value: '13px',
              missing: true,
              state: { state: 'none', nearest: spacing(2) },
            }),
            row('Padding right', ['padding-right'], { value: '0px', state: { state: 'none', nearest: null } }),
          ],
        },
      ],
      null,
      null,
    )
    expect(issues).toEqual([
      {
        kind: 'no-token',
        target: chips,
        property: 'gap',
        value: '16px',
        state: 'equal',
        token: { id: 'spacing.2', name: 'spacing.2', code: 2 },
        set: 'screen',
      },
      {
        kind: 'no-token',
        target: note,
        property: 'padding-top',
        value: '13px',
        state: 'none',
        token: { id: 'spacing.2', name: 'spacing.2', code: 2 },
        set: 'library',
      },
    ])
  })

  test('a row with no nearest token gives no-token with no token', () => {
    const box = target(10, 5)
    const issues = screenIssues(
      [{ target: box, rows: [row('Padding', padding, { missing: true, state: { state: 'none', nearest: null } })], links: [] }],
      null,
      null,
    )
    expect(issues).toEqual([{ kind: 'no-token', target: box, property: 'padding', value: '16px', state: 'none', set: 'library' }])
  })

  test('a linked row and a row that is not missing (a group with no tokens) give nothing', () => {
    const box = target(10, 5)
    const issues = screenIssues(
      [
        {
          target: box,
          links: [],
          rows: [
            row('Padding', padding),
            row('Width', ['border-top-width'], {
              group: 'stroke',
              state: { state: 'none', nearest: null },
              tokens: [],
              value: '1px',
            }),
          ],
        },
      ],
      null,
      null,
    )
    expect(issues).toEqual([])
  })

  test('a row from the inline style gives override, or no-token when it has no token: one value is one issue', () => {
    const footer = target(76, 7, { tag: 'div', origin: 'host' })
    const issues = screenIssues(
      [
        {
          target: footer,
          links: [],
          rows: [
            row('Fill', ['background-color'], { group: 'color', value: '#1F4FD8', inline: true }),
            row('Padding', padding, {
              value: '24px',
              inline: true,
              missing: true,
              state: { state: 'equal', token: spacing(3) },
            }),
            row('Display', ['display'], { group: null, state: null, tokens: [], value: 'flex', inline: true }),
          ],
        },
      ],
      null,
      null,
    )
    expect(issues).toEqual([
      { kind: 'not-library', target: footer },
      { kind: 'override', target: footer, property: 'background-color', value: '#1F4FD8' },
      {
        kind: 'no-token',
        target: footer,
        property: 'padding',
        value: '24px',
        state: 'equal',
        token: { id: 'spacing.3', name: 'spacing.3', code: 3 },
        set: 'screen',
      },
      { kind: 'override', target: footer, property: 'display', value: 'flex' },
    ])
  })

  test('an element with the origin host or local gives not-library; library gives nothing', () => {
    const div = target(76, 7, { tag: 'div', origin: 'host' })
    const local = target(20, 7, { tag: 'Feature', origin: 'local' })
    const button = target(30, 7, { tag: 'Button', origin: 'library', element: 'button' })
    const issues = screenIssues(
      [
        { target: div, rows: [], links: [] },
        { target: local, rows: [], links: [] },
        { target: button, rows: [], links: [] },
      ],
      null,
      null,
    )
    expect(issues).toEqual([
      { kind: 'not-library', target: local },
      { kind: 'not-library', target: div },
    ])
  })

  test('each broken link of a place gives broken-link, after not-library and before the values', () => {
    const card = target(30, 7, { tag: 'Card', origin: 'local' })
    const button = target(40, 9, { tag: 'Button', element: 'a', label: 'Next' })
    const missing = row('Gap', gap, { missing: true, state: { state: 'equal', token: spacing(2) } })
    const issues = screenIssues(
      [
        { target: button, rows: [], links: ['#/onboarding/nothing'] },
        { target: card, rows: [missing], links: ['#/a', '#/b'] },
      ],
      null,
      null,
    )
    expect(issues.map((issue) => [issue.kind, 'href' in issue ? issue.href : null])).toEqual([
      ['not-library', null],
      ['broken-link', '#/a'],
      ['broken-link', '#/b'],
      ['no-token', null],
      ['broken-link', '#/onboarding/nothing'],
    ])
    expect(issues[4]).toEqual({ kind: 'broken-link', target: button, href: '#/onboarding/nothing' })
  })

  test('a render error gives render-error first', () => {
    const div = target(76, 7, { tag: 'div', origin: 'host' })
    expect(screenIssues([{ target: div, rows: [], links: [] }], 'Cannot read x of undefined', null)).toEqual([
      { kind: 'render-error', text: 'Cannot read x of undefined' },
      { kind: 'not-library', target: div },
    ])
    expect(screenIssues([], '  ', null)).toEqual([{ kind: 'render-error', text: 'The screen failed to render.' }])
  })

  test('a broken relation gives relation after a render error and before the places', () => {
    const div = target(76, 7, { tag: 'div', origin: 'host' })
    const cause = 'stateOf: no screen has the id onboarding/nothing'
    expect(screenIssues([{ target: div, rows: [], links: [] }], null, cause)).toEqual([
      { kind: 'relation', text: cause },
      { kind: 'not-library', target: div },
    ])
    expect(screenIssues([], 'Boom', cause)).toEqual([
      { kind: 'render-error', text: 'Boom' },
      { kind: 'relation', text: cause },
    ])
  })

  test('no relation issue when the relation is null', () => {
    expect(screenIssues([], null, null)).toEqual([])
  })

  test('one issue for each place in the code, not for each copy', () => {
    const chip = target(53, 15, { tag: 'Chip', origin: 'local', copies: 3, label: 'Real components' })
    const copy = { ...chip, label: 'Design tokens' }
    const missing = row('Gap', gap, { missing: true, state: { state: 'equal', token: spacing(2) } })
    const issues = screenIssues(
      [
        { target: chip, rows: [missing], links: [] },
        { target: copy, rows: [missing], links: [] },
      ],
      null,
      null,
    )
    expect(issues.map((issue) => issue.kind)).toEqual(['not-library', 'no-token'])
    expect(issues.every((issue) => 'target' in issue && issue.target.label === 'Real components')).toBe(true)
  })

  test('the sequence follows the place in the code, not the sequence of the elements', () => {
    const a = target(40, 9, { tag: 'div', origin: 'host' })
    const b = target(40, 3, { tag: 'span', origin: 'host' })
    const c = target(12, 20, { tag: 'p', origin: 'host' })
    const d = target(5, 1, { file: 'screens/a/other.tsx', tag: 'i', origin: 'host' })
    const elements: IssueElement[] = [
      { target: a, rows: [], links: [] },
      { target: b, rows: [], links: [] },
      { target: c, rows: [], links: [] },
      { target: d, rows: [], links: [] },
    ]
    const order = (list: IssueElement[]) =>
      screenIssues(list, null, null).map((issue) => ('target' in issue ? issue.target.tag : ''))
    expect(order(elements)).toEqual(['i', 'p', 'span', 'div'])
    expect(order([...elements].reverse())).toEqual(['i', 'p', 'span', 'div'])
  })

  test('the issues pass the check of the issues file', () => {
    const footer = target(76, 7, { tag: 'div', origin: 'host' })
    const issues = screenIssues(
      [
        {
          target: footer,
          links: [],
          rows: [
            row('Text', ['color'], {
              group: 'color',
              value: '#667085',
              inline: true,
              missing: true,
              state: { state: 'none', nearest: primary },
            }),
          ],
        },
      ],
      'Boom',
      null,
    )
    issues.push({ kind: 'broken-link', target: footer, href: '#/nothing' })
    const file = { version: 1 as const, screen: 'onboarding/welcome', file: footer.file, issues }
    expect(parseIssues(JSON.parse(JSON.stringify(file)))).toEqual(file)
  })
})

describe('rowProperty', () => {
  test('one property gives itself', () => {
    expect(rowProperty(['padding-top'])).toBe('padding-top')
  })

  test('the properties of a shorthand give the shorthand, in any sequence', () => {
    expect(rowProperty(padding)).toBe('padding')
    expect(rowProperty(['margin-left', 'margin-top', 'margin-right', 'margin-bottom'])).toBe('margin')
    expect(rowProperty(gap)).toBe('gap')
    expect(
      rowProperty([
        'border-top-left-radius',
        'border-top-right-radius',
        'border-bottom-right-radius',
        'border-bottom-left-radius',
      ]),
    ).toBe('border-radius')
    expect(rowProperty(['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'])).toBe(
      'border-width',
    )
    expect(rowProperty(['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'])).toBe(
      'border-color',
    )
    expect(rowProperty(['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'])).toBe('font')
  })

  test('other lists give the properties with commas', () => {
    expect(rowProperty(['border-top-color', 'border-left-color'])).toBe('border-top-color, border-left-color')
  })
})

describe('overflowText', () => {
  test('says nothing for a content that fits, also with a part of a pixel more', () => {
    expect(overflowText(390, 390, [])).toBeNull()
    expect(overflowText(390, 390.4, [])).toBeNull()
  })

  test('says how much wider the content is, and names the narrowest element that goes over the edge', () => {
    const text = overflowText(390, 512, [
      { tag: 'Stack', file: 'screens/a/b.tsx', line: 12, width: 512 },
      { tag: 'Table', file: 'components/Report.tsx', line: 20, width: 480 },
    ])
    expect(text).toBe(
      'The content is 122 px wider than the screen (390 px): a person must scroll to the side. It goes over the edge at Table, line 20 of components/Report.tsx.',
    )
    expect(overflowText(390, 400, [])).toBe('The content is 10 px wider than the screen (390 px): a person must scroll to the side.')
  })

  test('is an issue of the screen with no target, after a broken relation', () => {
    expect(screenIssues([], null, 'broken', 'too wide')).toEqual([
      { kind: 'relation', text: 'broken' },
      { kind: 'layout', text: 'too wide' },
    ])
  })
})

describe('rowIsSet', () => {
  test('finds a value of the mark in the value of a row', () => {
    expect(rowIsSet('16px', ['16'])).toBe(true)
    expect(rowIsSet('#1f4fd8 70%', ['#1F4FD8'])).toBe(true)
    expect(rowIsSet('14px / 21px · 400', ['14'])).toBe(true)
    expect(rowIsSet('-8px', ['8'])).toBe(true)
    expect(rowIsSet('22px', ['16', '2'])).toBe(false)
    expect(rowIsSet('15px / 21.75px · 600', ['600'])).toBe(false)
  })

  test('a count of pixels is the same within the rounding of the browser', () => {
    expect(rowIsSet('26.099999px', ['26.1'])).toBe(true)
    expect(rowIsSet('26.2px', ['26.1'])).toBe(false)
  })

  test('a marked element with values gives `screen` to each row, and `written` to a row with one of the values', () => {
    const button = target(66, 15, { tag: 'Button' })
    const issues = screenIssues(
      [
        {
          target: button,
          set: true,
          values: ['13'],
          links: [],
          rows: [
            row('Padding top', ['padding-top'], { value: '13px', missing: true, state: { state: 'none', nearest: spacing(2) } }),
            row('Padding right', ['padding-right'], { value: '22px', missing: true, state: { state: 'none', nearest: spacing(3) } }),
          ],
        },
      ],
      null,
      null,
    )
    expect(issues.map((issue) => issue.kind === 'no-token' && [issue.set, issue.written])).toEqual([
      ['screen', true],
      ['screen', undefined],
    ])
    expect(issueSummary(issues[0])).toBe('padding-top: 13px, nearest spacing.2, written in the file')
  })
})

describe('issueGroups', () => {
  const footer = target(40, 7, { tag: 'div', origin: 'host' })
  const error: Issue = { kind: 'render-error', text: 'Boom' }
  const local: Issue = { kind: 'not-library', target: footer }
  const gapIssue: Issue = { kind: 'no-token', target: footer, property: 'gap', value: '16px', state: 'none' }
  const colorIssue: Issue = { kind: 'no-token', target: footer, property: 'color', value: '#333', state: 'none' }
  const override: Issue = { kind: 'override', target: footer, property: 'margin-left', value: '5px' }
  const link: Issue = { kind: 'broken-link', target: footer, href: '#/nothing' }
  const relation: Issue = { kind: 'relation', text: 'optionOf: the screen itself' }

  test('groups the issues by kind, in a fixed sequence of the groups, and keeps the sequence in a group', () => {
    expect(issueGroups([gapIssue, local, link, relation, override, colorIssue, error])).toEqual([
      { kind: 'render-error', issues: [error] },
      { kind: 'relation', issues: [relation] },
      { kind: 'broken-link', issues: [link] },
      { kind: 'not-library', issues: [local] },
      { kind: 'no-token', issues: [gapIssue, colorIssue] },
      { kind: 'override', issues: [override] },
    ])
  })

  test('puts the defaults of the library in a last group', () => {
    const fromLibrary: Issue = { ...gapIssue, set: 'library' }
    const fromScreen: Issue = { ...colorIssue, set: 'screen' }
    expect(issueGroups([fromLibrary, fromScreen, override])).toEqual([
      { kind: 'no-token', issues: [fromScreen] },
      { kind: 'override', issues: [override] },
      { kind: 'library', issues: [fromLibrary] },
    ])
  })

  test('a kind with no issues has no group', () => {
    expect(issueGroups([gapIssue])).toEqual([{ kind: 'no-token', issues: [gapIssue] }])
    expect(issueGroups([])).toEqual([])
  })
})

describe('issueSummary', () => {
  const footer = target(40, 7, { tag: 'div', origin: 'host' })
  const ref = { id: 'spacing.2', name: 'spacing.2', code: 2 }

  test('a value with no token link names its state and its token', () => {
    expect(issueSummary({ kind: 'no-token', target: footer, property: 'gap', value: '16px', state: 'equal', token: ref })).toBe(
      'gap: 16px, equal to spacing.2',
    )
    expect(
      issueSummary({ kind: 'no-token', target: footer, property: 'padding-top', value: '13px', state: 'none', token: ref }),
    ).toBe('padding-top: 13px, nearest spacing.2')
    expect(issueSummary({ kind: 'no-token', target: footer, property: 'color', value: '#333', state: 'none' })).toBe(
      'color: #333, no token',
    )
  })

  test('an override, an element that is not from the library, and a render error', () => {
    expect(issueSummary({ kind: 'override', target: footer, property: 'margin-left', value: '5px' })).toBe(
      'margin-left: 5px in the inline style',
    )
    expect(issueSummary({ kind: 'not-library', target: footer })).toBe('HTML element, not from the library')
    expect(issueSummary({ kind: 'not-library', target: { ...footer, origin: 'local', tag: 'Hero' } })).toBe(
      'local component, not from the library',
    )
    expect(issueSummary({ kind: 'render-error', text: 'Boom' })).toBe('Boom')
  })

  test('a broken relation gives its cause', () => {
    expect(issueSummary({ kind: 'relation', text: 'stateOf: a base in a different flow' })).toBe(
      'stateOf: a base in a different flow',
    )
  })

  test('a broken link names its address', () => {
    expect(issueSummary({ kind: 'broken-link', target: footer, href: '#/onboarding/nothing' })).toBe(
      'link to #/onboarding/nothing, no screen with this id',
    )
  })
})
