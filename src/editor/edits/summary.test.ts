import { describe, expect, test } from 'vitest'
import type { Change, Edit, Target } from '../../requests/format.ts'
import { summaryOf } from './summary.ts'

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

const edit = (change: Change): Edit => ({ id: 'e1', target, width: 390, change })

const spacing2 = { id: 'spacing.2', name: 'spacing.2', code: 2 }
const padding = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']

describe('summaryOf', () => {
  test('a style edit names the row and gives the value or the token on each side', () => {
    const change: Change = {
      kind: 'style',
      properties: padding,
      before: { value: '20px', observed: true },
      after: { value: '16px', token: spacing2 },
    }
    expect(summaryOf(edit(change))).toBe('Padding: 20px → spacing.2')
  })

  test('a token on the before side gives its name', () => {
    const change: Change = {
      kind: 'style',
      properties: ['background-color'],
      before: { value: '#1f4fd8', token: { id: 'palette.primary.main', name: 'primary.main', code: 'primary.main' } },
      after: { value: '#9c27b0', token: { id: 'palette.secondary.main', name: 'secondary.main', code: 'secondary.main' } },
    }
    expect(summaryOf(edit(change))).toBe('Fill: primary.main → secondary.main')
  })

  test('one side, a pair of gaps, the corners, and a layout value', () => {
    const style = (properties: string[], before = '8px', after = '16px'): Change => ({
      kind: 'style',
      properties,
      before: { value: before, observed: true },
      after: { value: after },
    })
    expect(summaryOf(edit(style(['padding-left'])))).toBe('Padding left: 8px → 16px')
    expect(summaryOf(edit(style(['row-gap', 'column-gap'])))).toBe('Gap: 8px → 16px')
    expect(summaryOf(edit(style(['border-top-left-radius'])))).toBe('Radius top left: 8px → 16px')
    expect(
      summaryOf(
        edit(
          style([
            'border-top-left-radius',
            'border-top-right-radius',
            'border-bottom-right-radius',
            'border-bottom-left-radius',
          ]),
        ),
      ),
    ).toBe('Radius: 8px → 16px')
    expect(summaryOf(edit(style(['flex-direction'], 'column', 'row'))))
      .toBe('Direction: column → row')
  })

  test('properties with no row name give the properties', () => {
    const change: Change = {
      kind: 'style',
      properties: ['padding-top', 'margin-left'],
      before: { value: '8px', observed: true },
      after: { value: '16px' },
    }
    expect(summaryOf(edit(change))).toBe('padding-top, margin-left: 8px → 16px')
  })

  test('a text style edit', () => {
    const change: Change = {
      kind: 'textStyle',
      before: { value: '12px / 20px · 400', token: { id: 'typography.caption', name: 'caption', code: 'caption' } },
      after: { value: '14px / 20px · 400', token: { id: 'typography.body2', name: 'body2', code: 'body2' } },
    }
    expect(summaryOf(edit(change))).toBe('Text style: caption → body2')
  })

  test('a text edit', () => {
    expect(summaryOf(edit({ kind: 'text', before: 'Welcome', after: 'Hello' }))).toBe('Text: "Welcome" → "Hello"')
  })

  test('a long text is cut', () => {
    const long = 'Plan the week together with the people you work with'
    expect(summaryOf(edit({ kind: 'text', before: 'Welcome', after: long }))).toBe(
      'Text: "Welcome" → "Plan the week together w…"',
    )
  })

  test('a removal', () => {
    expect(summaryOf(edit({ kind: 'remove' }))).toBe('Removed')
  })

  test('a move gives the positions from one', () => {
    expect(summaryOf(edit({ kind: 'order', before: 2, after: 1, of: 4, previewed: true }))).toBe(
      'Moved from 3 to 2 of 4',
    )
  })

  test('a comment gives its first line with text, cut', () => {
    expect(summaryOf(edit({ kind: 'comment', text: 'Make this a table.' }))).toBe('Comment: Make this a table.')
    expect(summaryOf(edit({ kind: 'comment', text: '\n  Add an empty state\nwith a retry.' }))).toBe(
      'Comment: Add an empty state',
    )
    const long = 'Use a table with one row for each member'
    expect(summaryOf(edit({ kind: 'comment', text: long }))).toBe(`Comment: ${long.slice(0, 24)}…`)
  })

  test('a comment on the screen has the same summary', () => {
    const screen: Edit = { id: 'c1', target: null, width: 390, change: { kind: 'comment', text: 'Add a title.' } }
    expect(summaryOf(screen)).toBe('Comment: Add a title.')
  })
})

