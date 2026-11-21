import type { TextStyle, Token, TokenGroup } from '../../tokens/format.ts'
import { corners, sides, type Side } from '../tokens/declarations.ts'
import { matchTextStyle, matchValue, type ValueGroup, type ValueState } from '../tokens/match.ts'
import { parseColor, parseLength } from '../tokens/normalize.ts'
import type { ElementStyles, StyleProperty, StyleValue } from '../tokens/read-styles.ts'

// What the inspector shows for the styles of an element: the sections with
// their rows, and the count of the values that have no token.
//
// A row has a label, the value as the inspector shows it, and the state of the
// value. A value with no state (a transparent color, a zero length, no
// shadow) is left out, and a section with no rows is left out. The four sides
// of a box (padding, margin, border, corners) give one row when the four
// values and their states are equal, else one row for each side.
//
// A row of four equal sides (padding, margin, corners) can be split into one
// row for each side, thus each side gets its own control: `split` names the
// rows that the user split.
//
// The text color and the text style show only for an element with text of
// its own: each element inherits them, thus a box of other elements would
// show the values of its parent again.

// The rows of four sides that the user can split into one row for each side.
export type SidesKey = 'Padding' | 'Margin' | 'Radius'

export type FourSides = { key: SidesKey; split: boolean }

export type SectionTitle = 'Color' | 'Stroke' | 'Elevation' | 'Typography' | 'Spacing' | 'Corners' | 'Layout'

export type InspectorRow = {
  label: string
  value: string
  // The token group of the value; null for a layout value, which has no
  // tokens and no state.
  group: TokenGroup | null
  state: ValueState | null
  // The computed color for the swatch of a color value.
  swatch?: string
  // The CSS longhand properties of the row: four for one row of four equal
  // sides, five for the text style.
  properties: string[]
  // The condition of the media rule that has the winning declaration, when
  // there is one.
  media?: string
  // True when the winning declaration of the value is in the inline style of
  // the element itself (the `style` prop): a local override. A value that the
  // element inherits from the inline style of a parent is not one.
  inline?: true
  // The tokens of the group, in a fixed sequence (see `groupTokens`). Empty
  // for a layout value and for a group with no tokens: such a row is
  // read-only.
  tokens: Token[]
  // For a row of four equal sides: `split: false` on the one row of all
  // sides, which can be split; `split: true` on the first row of the four
  // sides that the user split while their values are still equal, which can
  // be joined again. No `sides` for sides with different values.
  sides?: FourSides
  // True for a value with no token link (`equal` or `none`) when the token
  // file has tokens of its group: the inspector counts it and marks it. A
  // group with no tokens (the border widths of the sample library) is not
  // counted: no link is possible.
  missing: boolean
}

export type InspectorSection = { title: SectionTitle; rows: InspectorRow[] }

export type InspectorModel = {
  sections: InspectorSection[]
  // The rows that are `missing` a token link.
  noToken: number
}

// A computed color as the inspector shows it: `#1F4FD8`, or `#000000 60%`
// with an opacity. A color that cannot be read is shown as it is.
export function colorText(computed: string): string {
  const color = parseColor(computed)
  if (!color) return computed
  const hex = [color.r, color.g, color.b].map((channel) => channel.toString(16).padStart(2, '0')).join('')
  const alpha = Math.round(color.a * 100)
  return `#${hex.toUpperCase()}${alpha < 100 ? ` ${alpha}%` : ''}`
}

function stateToken(state: ValueState): Token | null {
  return state.state === 'none' ? state.nearest : state.token
}

function sameState(a: ValueState | null, b: ValueState | null) {
  if (a === null || b === null) return a === b
  return a.state === b.state && stateToken(a)?.id === stateToken(b)?.id && a.negative === b.negative
}

// `tokens` are the tokens of the group.
function isMissing(state: ValueState | null, tokens: readonly Token[]): boolean {
  if (state === null || state.state === 'linked') return false
  return tokens.length > 0
}

// The groups whose tokens are lengths: their steps go from small to large.
const lengthGroups: ReadonlySet<TokenGroup> = new Set(['spacing', 'radius', 'stroke'])

// The tokens of a group in a fixed sequence: a length group from the smallest
// to the largest value, any other group (color, shadow, text style) in the
// sequence of the token file. A token with a length that cannot be read goes
// to the end.
export function groupTokens(group: TokenGroup, tokens: readonly Token[]): Token[] {
  const list = tokens.filter((token) => token.group === group)
  if (!lengthGroups.has(group)) return list
  const size = (token: Token) => (typeof token.value === 'string' ? parseLength(token.value) : null) ?? Infinity
  return list
    .map((token, index) => ({ token, index, size: size(token) }))
    .sort((a, b) => a.size - b.size || a.index - b.index)
    .map((entry) => entry.token)
}

// The tokens of a group (`groupTokens`) of the token list of a model.
type Groups = (group: TokenGroup) => Token[]

function isInline(value: StyleValue): boolean {
  return value.source?.inline === true && !value.inherited
}

function valueRow(label: string, property: StyleProperty, value: StyleValue, groups: Groups): InspectorRow {
  const group = value.group as ValueGroup
  const tokens = groups(group)
  const state = matchValue(group, value.computed, value.declared, tokens)
  const row: InspectorRow = {
    label,
    value: group === 'color' ? colorText(value.computed) : value.computed,
    group,
    state,
    missing: isMissing(state, tokens),
    properties: [property],
    tokens,
  }
  if (group === 'color') row.swatch = value.computed
  if (value.source?.media) row.media = value.source.media
  if (isInline(value)) row.inline = true
  return row
}

type Part = { label: string; property: StyleProperty; value: StyleValue }

// The rows that have a state: a value with no state is not shown.
function withState(rows: readonly InspectorRow[]): InspectorRow[] {
  return rows.filter((row) => row.state !== null)
}

// One row with `label` when there are `total` parts and all values and their
// states are equal, else one row for each part. Rows with no state are left
// out. One row has the properties of all parts, and the first media condition
// of a part.
//
// `fourSides` is for a row of four sides that the user can split: with
// `split` the equal parts give one row for each part, and the first row can
// join them again.
function partRows(
  label: string,
  parts: readonly Part[],
  total: number,
  groups: Groups,
  fourSides?: FourSides,
): InspectorRow[] {
  const rows = parts.map((part) => valueRow(part.label, part.property, part.value, groups))
  const first = rows[0]
  const one =
    first !== undefined &&
    parts.length === total &&
    parts.every((part) => part.value.computed === parts[0].value.computed) &&
    rows.every((row) => sameState(row.state, first.state))
  if (!one) return withState(rows)
  if (fourSides?.split) return withState([{ ...first, sides: fourSides }, ...rows.slice(1)])
  const row: InspectorRow = { ...first, label, properties: parts.map((part) => part.property) }
  const media = rows.find((entry) => entry.media !== undefined)?.media
  if (media !== undefined) row.media = media
  // One part in the inline style makes the row an override.
  if (rows.some((entry) => entry.inline)) row.inline = true
  if (fourSides) row.sides = fourSides
  return withState([row])
}

function sideRows(
  label: string,
  property: (side: Side) => StyleProperty,
  styles: ElementStyles,
  groups: Groups,
  fourSides?: FourSides,
) {
  const parts = sides.map((side) => ({
    label: `${label} ${side}`,
    property: property(side),
    value: styles.values[property(side)],
  }))
  return partRows(label, parts, sides.length, groups, fourSides)
}

function strokeRows(styles: ElementStyles, groups: Groups): InspectorRow[] {
  const widths = sideRows('Width', (side) => `border-${side}-width` as const, styles, groups)
  // The color of a side with no border is not shown.
  const withBorder = sides.filter(
    (side) => (parseLength(styles.values[`border-${side}-width` as const].computed) ?? 0) > 0,
  )
  const colors = partRows(
    'Color',
    withBorder.map((side) => ({
      label: `Color ${side}`,
      property: `border-${side}-color` as const,
      value: styles.values[`border-${side}-color` as const],
    })),
    sides.length,
    groups,
  )
  return [...widths, ...colors]
}

function layoutRows(styles: ElementStyles): InspectorRow[] {
  const row = (label: string, property: StyleProperty): InspectorRow => {
    const value = styles.values[property]
    const result: InspectorRow = {
      label,
      value: value.computed,
      group: null,
      state: null,
      missing: false,
      properties: [property],
      tokens: [],
    }
    if (value.source?.media) result.media = value.source.media
    if (isInline(value)) result.inline = true
    return result
  }
  const display = styles.values.display.computed
  const flex = display.includes('flex')
  const grid = display.includes('grid')
  return [
    row('Display', 'display'),
    ...(flex ? [row('Direction', 'flex-direction'), row('Wrap', 'flex-wrap')] : []),
    ...(flex || grid ? [row('Align', 'align-items'), row('Justify', 'justify-content')] : []),
  ]
}

// The CSS properties of a text style.
const textStyleProperties = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing']

// A text style as the inspector shows it: `16px / 24px · 400`.
export function textStyleText(style: TextStyle): string {
  return `${style.fontSize} / ${style.lineHeight} · ${style.fontWeight}`
}

function textStyleRows(styles: ElementStyles, groups: Groups): InspectorRow[] {
  const { computed } = styles.textStyle
  const tokens = groups('textStyle')
  const state = matchTextStyle(computed, styles.textStyle, tokens)
  const row: InspectorRow = {
    label: 'Text style',
    value: textStyleText(computed),
    group: 'textStyle',
    state,
    missing: isMissing(state, tokens),
    properties: [...textStyleProperties],
    tokens,
  }
  if (styles.textStyle.inline) row.inline = true
  return [row]
}

// `split`: the rows of four sides that the user split into one row for each
// side.
export function inspectorModel(
  styles: ElementStyles,
  tokens: readonly Token[],
  split: ReadonlySet<SidesKey> = new Set(),
): InspectorModel {
  const values = styles.values
  const groups: Groups = (group) => groupTokens(group, tokens)
  const splitOf = (key: SidesKey): FourSides => ({ key, split: split.has(key) })
  const gap = partRows(
    'Gap',
    [
      { label: 'Row gap', property: 'row-gap', value: values['row-gap'] },
      { label: 'Column gap', property: 'column-gap', value: values['column-gap'] },
    ],
    2,
    groups,
  )

  const sections: InspectorSection[] = [
    {
      title: 'Color',
      rows: withState([
        valueRow('Fill', 'background-color', values['background-color'], groups),
        ...(styles.ownText ? [valueRow('Text', 'color', values.color, groups)] : []),
      ]),
    },
    { title: 'Stroke', rows: strokeRows(styles, groups) },
    { title: 'Elevation', rows: withState([valueRow('Shadow', 'box-shadow', values['box-shadow'], groups)]) },
    { title: 'Typography', rows: styles.ownText ? textStyleRows(styles, groups) : [] },
    {
      title: 'Spacing',
      rows: [
        ...sideRows('Padding', (side) => `padding-${side}` as const, styles, groups, splitOf('Padding')),
        ...sideRows('Margin', (side) => `margin-${side}` as const, styles, groups, splitOf('Margin')),
        ...gap,
      ],
    },
    {
      title: 'Corners',
      rows: partRows(
        'Radius',
        corners.map((corner) => ({
          label: `Radius ${corner.replace('-', ' ')}`,
          property: `border-${corner}-radius` as const,
          value: values[`border-${corner}-radius` as const],
        })),
        corners.length,
        groups,
        splitOf('Radius'),
      ),
    },
    { title: 'Layout', rows: layoutRows(styles) },
  ]

  const shown = sections.filter((section) => section.rows.length > 0)
  const noToken = shown.flatMap((section) => section.rows).filter((row) => row.missing).length
  return { sections: shown, noToken }
}
