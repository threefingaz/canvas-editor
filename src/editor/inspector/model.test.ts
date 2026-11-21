import { describe, expect, test } from 'vitest'
import type { TextStyle, Token } from '../../tokens/format.ts'
import { styleProperties, type ElementStyles, type StyleProperty } from '../tokens/read-styles.ts'
import { colorText, groupTokens, inspectorModel, type InspectorModel } from './model.ts'

const font = 'system-ui, sans-serif'

const primary: Token = {
  id: 'palette.primary.main',
  group: 'color',
  name: 'primary.main',
  value: '#1f4fd8',
  cssVar: '--mui-palette-primary-main',
  code: 'primary.main',
}
const textPrimary: Token = {
  id: 'palette.text.primary',
  group: 'color',
  name: 'text.primary',
  value: '#101828',
  cssVar: '--mui-palette-text-primary',
  code: 'text.primary',
}

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
const radius: Token = {
  id: 'shape.borderRadius',
  group: 'radius',
  name: 'radius',
  value: '8px',
  cssVar: '--mui-shape-borderRadius',
  code: 1,
}
const shadow: Token = {
  id: 'shadows.1',
  group: 'shadow',
  name: 'shadows.1',
  value: '0px 1px 2px 0px rgba(16, 24, 40, 0.05)',
  cssVar: '--mui-shadows-1',
  code: 1,
}
const body1Style: TextStyle = {
  fontFamily: font,
  fontSize: '16px',
  fontWeight: '400',
  lineHeight: '24px',
  letterSpacing: '0px',
}
const body1: Token = {
  id: 'typography.body1',
  group: 'textStyle',
  name: 'body1',
  value: body1Style,
  cssVar: '--mui-font-body1',
  code: 'body1',
  selector: '.MuiTypography-body1',
}

const tokens = [primary, textPrimary, spacing(2), spacing(1), spacing(4), radius, shadow, body1]
const spacingSteps = [spacing(1), spacing(2), spacing(4)]
const paddingProperties = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']

// The computed value of each property for an element with no styles of its
// own: a transparent fill, no border, no shadow, no space, a block.
const defaults: Record<StyleProperty, string> = {
  'background-color': 'rgba(0, 0, 0, 0)',
  color: 'rgb(16, 24, 40)',
  'border-top-width': '0px',
  'border-right-width': '0px',
  'border-bottom-width': '0px',
  'border-left-width': '0px',
  'border-top-color': 'rgb(16, 24, 40)',
  'border-right-color': 'rgb(16, 24, 40)',
  'border-bottom-color': 'rgb(16, 24, 40)',
  'border-left-color': 'rgb(16, 24, 40)',
  'box-shadow': 'none',
  'padding-top': '0px',
  'padding-right': '0px',
  'padding-bottom': '0px',
  'padding-left': '0px',
  'margin-top': '0px',
  'margin-right': '0px',
  'margin-bottom': '0px',
  'margin-left': '0px',
  'row-gap': 'normal',
  'column-gap': 'normal',
  'border-top-left-radius': '0px',
  'border-top-right-radius': '0px',
  'border-bottom-right-radius': '0px',
  'border-bottom-left-radius': '0px',
  display: 'block',
  'flex-direction': 'row',
  'flex-wrap': 'nowrap',
  'align-items': 'normal',
  'justify-content': 'normal',
}

type Options = {
  computed?: Partial<Record<StyleProperty, string>>
  declared?: Partial<Record<StyleProperty, string[]>>
  media?: Partial<Record<StyleProperty, string>>
  ownText?: boolean
  text?: Partial<TextStyle>
  textDeclared?: string[]
  classes?: string[]
  // The declared properties whose winning declaration is the inline style.
  inline?: StyleProperty[]
  // The declared properties whose winning declaration is on a parent node.
  inherited?: StyleProperty[]
  textInline?: boolean
}

// The styles of an element, as `readStyles` gives them, from plain values.
function styles(options: Options = {}): ElementStyles {
  const values = {} as ElementStyles['values']
  for (const { property, group } of styleProperties) {
    values[property] = {
      group,
      computed: options.computed?.[property] ?? defaults[property],
      declared: options.declared?.[property] ?? [],
      source: options.declared?.[property]
        ? options.inline?.includes(property)
          ? { inline: true }
          : { inline: false, ...(options.media?.[property] ? { media: options.media[property] } : {}) }
        : null,
    }
    if (options.inherited?.includes(property)) values[property].inherited = true
  }
  return {
    values,
    ownText: options.ownText ?? false,
    textStyle: {
      computed: { ...body1Style, ...options.text },
      texts: options.textDeclared ?? [],
      ...(options.textInline ? { inline: true } : {}),
      matches: (selector) => (options.classes ?? []).some((name) => selector === `.${name}`),
    },
  }
}

function section(model: InspectorModel, title: string) {
  return model.sections.find((entry) => entry.title === title)
}

function labels(model: InspectorModel, title: string) {
  return section(model, title)?.rows.map((row) => row.label)
}

describe('inspectorModel', () => {
  test('the sections come in a fixed sequence', () => {
    const model = inspectorModel(
      styles({
        ownText: true,
        computed: {
          'background-color': 'rgb(31, 79, 216)',
          'border-top-width': '1px',
          'border-right-width': '1px',
          'border-bottom-width': '1px',
          'border-left-width': '1px',
          'box-shadow': 'rgba(16, 24, 40, 0.05) 0px 1px 2px 0px',
          'padding-top': '16px',
          'padding-right': '16px',
          'padding-bottom': '16px',
          'padding-left': '16px',
          'border-top-left-radius': '8px',
          'border-top-right-radius': '8px',
          'border-bottom-right-radius': '8px',
          'border-bottom-left-radius': '8px',
        },
      }),
      tokens,
    )
    expect(model.sections.map((entry) => entry.title)).toEqual([
      'Color',
      'Stroke',
      'Elevation',
      'Typography',
      'Spacing',
      'Corners',
      'Layout',
    ])
  })

  test('four equal padding values give one row', () => {
    const padding = { 'padding-top': '16px', 'padding-right': '16px', 'padding-bottom': '16px', 'padding-left': '16px' }
    const declared = Object.fromEntries(Object.keys(padding).map((key) => [key, ['calc(2 * var(--mui-spacing, 8px))']]))
    const model = inspectorModel(styles({ computed: padding, declared }), tokens)
    expect(section(model, 'Spacing')?.rows).toEqual([
      {
        label: 'Padding',
        value: '16px',
        group: 'spacing',
        state: { state: 'linked', token: spacing(2) },
        missing: false,
        properties: paddingProperties,
        tokens: spacingSteps,
        sides: { key: 'Padding', split: false },
      },
    ])
  })

  test('split padding gives four rows with one property each, and the first can join them', () => {
    const padding = { 'padding-top': '16px', 'padding-right': '16px', 'padding-bottom': '16px', 'padding-left': '16px' }
    const declared = Object.fromEntries(Object.keys(padding).map((key) => [key, ['calc(2 * var(--mui-spacing, 8px))']]))
    const model = inspectorModel(styles({ computed: padding, declared }), tokens, new Set(['Padding']))
    const rows = section(model, 'Spacing')?.rows ?? []
    expect(rows.map((row) => row.label)).toEqual(['Padding top', 'Padding right', 'Padding bottom', 'Padding left'])
    expect(rows.map((row) => row.properties)).toEqual(paddingProperties.map((name) => [name]))
    expect(rows.map((row) => row.state)).toEqual(rows.map(() => ({ state: 'linked', token: spacing(2) })))
    expect(rows.map((row) => row.sides)).toEqual([{ key: 'Padding', split: true }, undefined, undefined, undefined])
  })

  test('a split changes only its own rows: margin and corners stay one row', () => {
    const computed = {
      'margin-top': '8px',
      'margin-right': '8px',
      'margin-bottom': '8px',
      'margin-left': '8px',
      'border-top-left-radius': '8px',
      'border-top-right-radius': '8px',
      'border-bottom-right-radius': '8px',
      'border-bottom-left-radius': '8px',
    }
    const joined = inspectorModel(styles({ computed }), tokens, new Set(['Padding']))
    expect(labels(joined, 'Spacing')).toEqual(['Margin'])
    expect(section(joined, 'Spacing')?.rows[0].sides).toEqual({ key: 'Margin', split: false })
    expect(section(joined, 'Corners')?.rows[0].sides).toEqual({ key: 'Radius', split: false })
    const split = inspectorModel(styles({ computed }), tokens, new Set(['Margin', 'Radius']))
    expect(labels(split, 'Spacing')).toEqual(['Margin top', 'Margin right', 'Margin bottom', 'Margin left'])
    expect(labels(split, 'Corners')).toEqual([
      'Radius top left',
      'Radius top right',
      'Radius bottom right',
      'Radius bottom left',
    ])
    expect(section(split, 'Corners')?.rows.map((row) => row.properties.length)).toEqual([1, 1, 1, 1])
  })

  test('sides with different values have no split mark; the gap and the stroke widths have none', () => {
    const model = inspectorModel(
      styles({
        computed: {
          'padding-top': '64px',
          'padding-right': '16px',
          'padding-bottom': '64px',
          'padding-left': '16px',
          'row-gap': '16px',
          'column-gap': '16px',
          'border-top-width': '1px',
          'border-right-width': '1px',
          'border-bottom-width': '1px',
          'border-left-width': '1px',
        },
      }),
      tokens,
      new Set(['Padding']),
    )
    expect(section(model, 'Spacing')?.rows.every((row) => row.sides === undefined)).toBe(true)
    expect(section(model, 'Stroke')?.rows.every((row) => row.sides === undefined)).toBe(true)
  })

  test('different padding values give four rows', () => {
    const model = inspectorModel(
      styles({
        computed: { 'padding-top': '64px', 'padding-right': '16px', 'padding-bottom': '64px', 'padding-left': '16px' },
      }),
      tokens,
    )
    expect(labels(model, 'Spacing')).toEqual(['Padding top', 'Padding right', 'Padding bottom', 'Padding left'])
    expect(section(model, 'Spacing')?.rows.map((row) => row.properties)).toEqual(paddingProperties.map((name) => [name]))
  })

  test('a row has the media condition of its winning declaration', () => {
    const padding = { 'padding-top': '16px', 'padding-right': '16px', 'padding-bottom': '16px', 'padding-left': '16px' }
    const declared = Object.fromEntries(Object.keys(padding).map((key) => [key, ['calc(2 * var(--mui-spacing))']]))
    const media = Object.fromEntries(Object.keys(padding).map((key) => [key, '(min-width: 600px)']))
    const model = inspectorModel(styles({ computed: padding, declared, media }), tokens)
    expect(section(model, 'Spacing')?.rows[0].media).toBe('(min-width: 600px)')
    const plain = inspectorModel(styles({ computed: padding, declared }), tokens)
    expect(section(plain, 'Spacing')?.rows[0]).not.toHaveProperty('media')
  })

  test('equal values with different states are not one row', () => {
    const model = inspectorModel(
      styles({
        computed: { 'padding-top': '16px', 'padding-right': '16px', 'padding-bottom': '16px', 'padding-left': '16px' },
        declared: { 'padding-top': ['calc(2 * var(--mui-spacing, 8px))'] },
      }),
      tokens,
    )
    const rows = section(model, 'Spacing')?.rows ?? []
    expect(rows.map((row) => row.label)).toEqual(['Padding top', 'Padding right', 'Padding bottom', 'Padding left'])
    expect(rows.map((row) => row.state?.state)).toEqual(['linked', 'equal', 'equal', 'equal'])
  })

  test('a value with no state is left out: zero, transparent, no shadow', () => {
    const model = inspectorModel(styles({ computed: { 'margin-top': '16px' } }), tokens)
    expect(labels(model, 'Spacing')).toEqual(['Margin top'])
    expect(section(model, 'Color')).toBeUndefined()
    expect(section(model, 'Elevation')).toBeUndefined()
  })

  test('a section with no values is left out', () => {
    const model = inspectorModel(styles(), tokens)
    expect(model.sections.map((entry) => entry.title)).toEqual(['Layout'])
    expect(model.noToken).toBe(0)
  })

  test('the text color and the text style show only for an element with text of its own', () => {
    const withText = inspectorModel(
      styles({ ownText: true, declared: { color: ['var(--mui-palette-text-primary)'] }, classes: ['MuiTypography-body1'] }),
      tokens,
    )
    expect(section(withText, 'Color')?.rows).toEqual([
      {
        label: 'Text',
        value: '#101828',
        group: 'color',
        state: { state: 'linked', token: textPrimary },
        swatch: 'rgb(16, 24, 40)',
        missing: false,
        properties: ['color'],
        tokens: [primary, textPrimary],
      },
    ])
    expect(section(withText, 'Typography')?.rows).toEqual([
      {
        label: 'Text style',
        value: '16px / 24px · 400',
        group: 'textStyle',
        state: { state: 'linked', token: body1 },
        missing: false,
        properties: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'],
        tokens: [body1],
      },
    ])
    const container = inspectorModel(styles(), tokens)
    expect(section(container, 'Color')).toBeUndefined()
    expect(section(container, 'Typography')).toBeUndefined()
  })

  test('a text style with no token gives its nearest style', () => {
    const model = inspectorModel(styles({ ownText: true, text: { fontSize: '14px', lineHeight: '20px' } }), tokens)
    const row = section(model, 'Typography')?.rows[0]
    expect(row?.value).toBe('14px / 20px · 400')
    expect(row?.state).toEqual({ state: 'none', nearest: body1 })
    expect(row?.missing).toBe(true)
  })

  test('the stroke color shows only for the sides with a border', () => {
    const model = inspectorModel(
      styles({ computed: { 'border-bottom-width': '1px', 'border-bottom-color': 'rgb(31, 79, 216)' } }),
      tokens,
    )
    expect(labels(model, 'Stroke')).toEqual(['Width bottom', 'Color bottom'])
    const all = inspectorModel(
      styles({
        computed: {
          'border-top-width': '1px',
          'border-right-width': '1px',
          'border-bottom-width': '1px',
          'border-left-width': '1px',
        },
      }),
      tokens,
    )
    expect(labels(all, 'Stroke')).toEqual(['Width', 'Color'])
    // No stroke token: the width has no nearest token, is not counted, and
    // has no steps.
    expect(section(all, 'Stroke')?.rows[0].state).toEqual({ state: 'none', nearest: null })
    expect(section(all, 'Stroke')?.rows[0].missing).toBe(false)
    expect(section(all, 'Stroke')?.rows[0].tokens).toEqual([])
    expect(section(all, 'Stroke')?.rows[0].properties).toEqual([
      'border-top-width',
      'border-right-width',
      'border-bottom-width',
      'border-left-width',
    ])
    expect(all.noToken).toBe(1)
  })

  test('the gap is one row when the row gap and the column gap are equal', () => {
    const one = inspectorModel(styles({ computed: { 'row-gap': '16px', 'column-gap': '16px' } }), tokens)
    expect(section(one, 'Spacing')?.rows).toEqual([
      {
        label: 'Gap',
        value: '16px',
        group: 'spacing',
        state: { state: 'equal', token: spacing(2) },
        missing: true,
        properties: ['row-gap', 'column-gap'],
        tokens: spacingSteps,
      },
    ])
    const two = inspectorModel(styles({ computed: { 'row-gap': '16px', 'column-gap': '32px' } }), tokens)
    expect(labels(two, 'Spacing')).toEqual(['Row gap', 'Column gap'])
  })

  test('the corners, the shadow and the fill', () => {
    const model = inspectorModel(
      styles({
        computed: {
          'background-color': 'rgb(31, 79, 216)',
          'box-shadow': 'rgba(16, 24, 40, 0.05) 0px 1px 2px 0px',
          'border-top-left-radius': '8px',
          'border-top-right-radius': '8px',
          'border-bottom-right-radius': '0px',
          'border-bottom-left-radius': '0px',
        },
        declared: { 'box-shadow': ['var(--mui-shadows-1)'] },
      }),
      tokens,
    )
    expect(section(model, 'Color')?.rows).toEqual([
      {
        label: 'Fill',
        value: '#1F4FD8',
        group: 'color',
        state: { state: 'equal', token: primary },
        swatch: 'rgb(31, 79, 216)',
        missing: true,
        properties: ['background-color'],
        tokens: [primary, textPrimary],
      },
    ])
    expect(section(model, 'Elevation')?.rows).toEqual([
      {
        label: 'Shadow',
        value: 'rgba(16, 24, 40, 0.05) 0px 1px 2px 0px',
        group: 'shadow',
        state: { state: 'linked', token: shadow },
        missing: false,
        properties: ['box-shadow'],
        tokens: [shadow],
      },
    ])
    expect(labels(model, 'Corners')).toEqual(['Radius top left', 'Radius top right'])
    expect(section(model, 'Corners')?.rows.map((row) => row.properties)).toEqual([
      ['border-top-left-radius'],
      ['border-top-right-radius'],
    ])
  })

  test('the layout shows the display, and the flex values only for a flex box', () => {
    const block = inspectorModel(styles(), tokens)
    expect(section(block, 'Layout')?.rows).toEqual([
      { label: 'Display', value: 'block', group: null, state: null, missing: false, properties: ['display'], tokens: [] },
    ])
    const flex = inspectorModel(
      styles({ computed: { display: 'flex', 'flex-direction': 'column', 'align-items': 'center' } }),
      tokens,
    )
    expect(section(flex, 'Layout')?.rows.map((row) => [row.label, row.value])).toEqual([
      ['Display', 'flex'],
      ['Direction', 'column'],
      ['Wrap', 'nowrap'],
      ['Align', 'center'],
      ['Justify', 'normal'],
    ])
    const grid = inspectorModel(styles({ computed: { display: 'grid' } }), tokens)
    expect(labels(grid, 'Layout')).toEqual(['Display', 'Align', 'Justify'])
  })

  test('the count of values with no token has the states equal and none', () => {
    const model = inspectorModel(
      styles({
        ownText: true,
        computed: {
          'background-color': 'rgb(31, 79, 216)', // equal
          'margin-top': '13px', // none
          'padding-top': '16px', // linked
          'padding-right': '16px',
          'padding-bottom': '16px',
          'padding-left': '16px',
        },
        declared: {
          color: ['var(--mui-palette-text-primary)'], // linked
          'padding-top': ['calc(2 * var(--mui-spacing))'],
          'padding-right': ['calc(2 * var(--mui-spacing))'],
          'padding-bottom': ['calc(2 * var(--mui-spacing))'],
          'padding-left': ['calc(2 * var(--mui-spacing))'],
        },
        text: { fontSize: '14px' }, // none
      }),
      tokens,
    )
    expect(model.noToken).toBe(3)
    const margin = section(model, 'Spacing')?.rows.find((row) => row.label === 'Margin top')
    expect(margin?.state).toEqual({ state: 'none', nearest: spacing(2) })
  })

  test('with no tokens, each value has no token and no nearest token, and is not counted', () => {
    const model = inspectorModel(styles({ computed: { 'margin-top': '16px' } }), [])
    expect(section(model, 'Spacing')?.rows[0].state).toEqual({ state: 'none', nearest: null })
    expect(model.noToken).toBe(0)
  })

  test('a margin declared auto has no row', () => {
    const margin = { 'margin-left': '120px', 'margin-right': '120px' }
    const model = inspectorModel(styles({ computed: margin, declared: { 'margin-left': ['auto'], 'margin-right': ['auto'] } }), tokens)
    expect(section(model, 'Spacing')).toBeUndefined()
  })

  test('a negative margin is linked by its negative factor', () => {
    const model = inspectorModel(
      styles({ computed: { 'margin-top': '-16px' }, declared: { 'margin-top': ['calc(-2 * var(--mui-spacing, 8px))'] } }),
      tokens,
    )
    expect(section(model, 'Spacing')?.rows[0].state).toEqual({ state: 'linked', token: spacing(2), negative: true })
    expect(model.noToken).toBe(0)
  })
})

describe('groupTokens', () => {
  test('a length group goes from the smallest to the largest value', () => {
    expect(groupTokens('spacing', tokens)).toEqual(spacingSteps)
  })

  test('a length that cannot be read goes to the end, and equal sizes keep the file sequence', () => {
    const odd: Token = { ...radius, id: 'radius.odd', value: 'auto' }
    const other: Token = { ...radius, id: 'radius.other' }
    expect(groupTokens('radius', [odd, radius, other]).map((token) => token.id)).toEqual([
      'shape.borderRadius',
      'radius.other',
      'radius.odd',
    ])
  })

  test('a color, a shadow and a text style keep the sequence of the token file', () => {
    expect(groupTokens('color', [textPrimary, primary])).toEqual([textPrimary, primary])
    expect(groupTokens('textStyle', tokens)).toEqual([body1])
  })

  test('a group with no tokens gives an empty list', () => {
    expect(groupTokens('stroke', tokens)).toEqual([])
  })
})

describe('colorText', () => {
  test('a color is shown in hex, with the opacity when it is not full', () => {
    expect(colorText('rgb(31, 79, 216)')).toBe('#1F4FD8')
    expect(colorText('rgba(0, 0, 0, 0.6)')).toBe('#000000 60%')
    expect(colorText('currentcolor')).toBe('currentcolor')
  })
})

describe('inspectorModel: local overrides', () => {
  const padding16 = { 'padding-top': '16px', 'padding-right': '16px', 'padding-bottom': '16px', 'padding-left': '16px' }
  const paddingDeclared = {
    'padding-top': ['16px'],
    'padding-right': ['16px'],
    'padding-bottom': ['16px'],
    'padding-left': ['16px'],
  }

  test('a value whose winner is the inline style of the element is inline', () => {
    const model = inspectorModel(
      styles({
        computed: { 'background-color': 'rgb(31, 79, 216)', display: 'flex' },
        declared: { 'background-color': ['#1f4fd8'], display: ['flex'] },
        inline: ['background-color', 'display'],
      }),
      tokens,
    )
    expect(section(model, 'Color')?.rows[0]).toMatchObject({ label: 'Fill', inline: true })
    expect(section(model, 'Layout')?.rows[0]).toMatchObject({ label: 'Display', inline: true })
  })

  test('a value from a rule is not inline', () => {
    const model = inspectorModel(
      styles({ computed: { 'background-color': 'rgb(31, 79, 216)' }, declared: { 'background-color': ['#1f4fd8'] } }),
      tokens,
    )
    expect(section(model, 'Color')?.rows[0].inline).toBeUndefined()
  })

  test('a value inherited from the inline style of a parent is not inline', () => {
    const model = inspectorModel(
      styles({
        ownText: true,
        computed: { color: 'rgb(102, 112, 133)' },
        declared: { color: ['#667085'] },
        inline: ['color'],
        inherited: ['color'],
      }),
      tokens,
    )
    expect(section(model, 'Color')?.rows.find((row) => row.label === 'Text')?.inline).toBeUndefined()
  })

  test('one row of four sides is inline when one side is inline', () => {
    const model = inspectorModel(
      styles({ computed: padding16, declared: paddingDeclared, inline: ['padding-left'] }),
      tokens,
    )
    expect(section(model, 'Spacing')?.rows).toMatchObject([{ label: 'Padding', inline: true }])
  })

  test('the text style row is inline when a part is in the inline style of the element', () => {
    const model = inspectorModel(styles({ ownText: true, text: { fontSize: '14px' }, textInline: true }), tokens)
    expect(section(model, 'Typography')?.rows[0]).toMatchObject({ label: 'Text style', inline: true })
    const plain = inspectorModel(styles({ ownText: true }), tokens)
    expect(section(plain, 'Typography')?.rows[0].inline).toBeUndefined()
  })
})
