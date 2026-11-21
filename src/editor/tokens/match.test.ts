import { describe, expect, test } from 'vitest'
import type { TextStyle, Token } from '../../tokens/format.ts'
import { matchTextStyle, matchValue } from './match.ts'

const primary: Token = {
  id: 'palette.primary.main',
  group: 'color',
  name: 'primary.main',
  value: '#1f4fd8',
  cssVar: '--mui-palette-primary-main',
  code: 'primary.main',
}
const white: Token = {
  id: 'palette.common.white',
  group: 'color',
  name: 'common.white',
  value: '#fff',
  cssVar: '--mui-palette-common-white',
  code: 'common.white',
}
const paper: Token = {
  id: 'palette.background.paper',
  group: 'color',
  name: 'background.paper',
  value: '#ffffff',
  cssVar: '--mui-palette-background-paper',
  code: 'background.paper',
}
const disabled: Token = {
  id: 'palette.text.disabled',
  group: 'color',
  name: 'text.disabled',
  value: 'rgba(0, 0, 0, 0.38)',
  cssVar: '--mui-palette-text-disabled',
  code: 'text.disabled',
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
const shadow1: Token = {
  id: 'shadows.1',
  group: 'shadow',
  name: 'shadows.1',
  value: '0px 1px 2px 0px rgba(16, 24, 40, 0.10)',
  cssVar: '--mui-shadows-1',
  code: 1,
}
const shadow2: Token = {
  id: 'shadows.2',
  group: 'shadow',
  name: 'shadows.2',
  value: '0px 2px 4px 0px rgba(16, 24, 40, 0.10)',
  cssVar: '--mui-shadows-2',
  code: 2,
}

const family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const body1Style: TextStyle = {
  fontFamily: family,
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
const h6: Token = {
  id: 'typography.h6',
  group: 'textStyle',
  name: 'h6',
  value: { fontFamily: family, fontSize: '18px', fontWeight: '600', lineHeight: '26.1px', letterSpacing: '0px' },
  cssVar: '--mui-font-h6',
  code: 'h6',
  selector: '.MuiTypography-h6',
}
const caption: Token = {
  id: 'typography.caption',
  group: 'textStyle',
  name: 'caption',
  value: { fontFamily: family, fontSize: '12px', fontWeight: '400', lineHeight: '16.8px', letterSpacing: '0.12px' },
  cssVar: '--mui-font-caption',
  code: 'caption',
  selector: '.MuiTypography-caption',
}

const tokens = [
  primary,
  white,
  paper,
  disabled,
  spacing(1),
  spacing(2),
  spacing(4),
  spacing(8),
  radius,
  shadow1,
  shadow2,
  body1,
  h6,
  caption,
]

describe('matchValue: linked', () => {
  test('a declared var of the token links it', () => {
    const state = matchValue('color', 'rgb(31, 79, 216)', ['var(--mui-palette-primary-main, #1f4fd8)'], tokens)
    expect(state).toEqual({ state: 'linked', token: primary })
  })

  test('a factor and a variable link the spacing token with that factor', () => {
    const state = matchValue('spacing', '32px', ['calc(4 * var(--mui-spacing, 8px))'], tokens)
    expect(state).toEqual({ state: 'linked', token: spacing(4) })
  })

  test('the factor can be after the variable', () => {
    const state = matchValue('spacing', '16px', ['calc(var(--mui-spacing) * 2)'], tokens)
    expect(state).toEqual({ state: 'linked', token: spacing(2) })
  })

  test('a plain variable is the factor 1', () => {
    expect(matchValue('spacing', '8px', ['var(--mui-spacing, 8px)'], tokens)).toEqual({
      state: 'linked',
      token: spacing(1),
    })
    expect(matchValue('radius', '8px', ['var(--mui-shape-borderRadius, 8px)'], tokens)).toEqual({
      state: 'linked',
      token: radius,
    })
  })

  test('the variable can be in the text of a variable that the winning text follows', () => {
    const state = matchValue('spacing', '64px', ['var(--stack-gap)', 'calc(8 * var(--mui-spacing))'], tokens)
    expect(state).toEqual({ state: 'linked', token: spacing(8) })
  })

  test('of two tokens with the same value, the declared one is linked', () => {
    const state = matchValue('color', 'rgb(255, 255, 255)', ['var(--mui-palette-background-paper)'], tokens)
    expect(state).toEqual({ state: 'linked', token: paper })
  })

  test('of two declared tokens with the same value, the one nearest to the element is linked', () => {
    // `--mui-palette-background-paper: var(--mui-palette-common-white)`: the
    // paper token is the one that the code writes.
    const declared = ['var(--mui-palette-background-paper)', 'var(--mui-palette-common-white)']
    expect(matchValue('color', 'rgb(255, 255, 255)', declared, tokens)).toEqual({ state: 'linked', token: paper })
    const reversed = ['var(--mui-palette-common-white)', 'var(--mui-palette-background-paper)']
    expect(matchValue('color', 'rgb(255, 255, 255)', reversed, tokens)).toEqual({ state: 'linked', token: white })
  })

  test('a shadow variable links the shadow token', () => {
    const state = matchValue('shadow', 'rgba(16, 24, 40, 0.1) 0px 2px 4px 0px', ['var(--mui-shadows-2)'], tokens)
    expect(state).toEqual({ state: 'linked', token: shadow2 })
  })
})

describe('matchValue: equal', () => {
  test('a fixed value that is equal to a token', () => {
    expect(matchValue('spacing', '16px', ['16px'], tokens)).toEqual({ state: 'equal', token: spacing(2) })
  })

  test('a color with opacity that is equal to a token', () => {
    expect(matchValue('color', 'rgba(0, 0, 0, 0.38)', [], tokens)).toEqual({ state: 'equal', token: disabled })
  })

  test('a declared variable whose token has a different value is not linked', () => {
    // The variable is set to a different value for the element.
    const state = matchValue('color', 'rgb(255, 255, 255)', ['var(--mui-palette-primary-main)'], tokens)
    expect(state).toEqual({ state: 'equal', token: white })
  })

  test('a different variable with the same start is not linked', () => {
    expect(matchValue('spacing', '16px', ['calc(2 * var(--mui-spacing-x))'], tokens)).toEqual({
      state: 'equal',
      token: spacing(2),
    })
  })

  test('the variable of the token with a different factor is not linked', () => {
    expect(matchValue('spacing', '16px', ['calc(3 * var(--mui-spacing))'], tokens)).toEqual({
      state: 'equal',
      token: spacing(2),
    })
  })
})

describe('matchValue: a multiple of the radius', () => {
  // `sx` `borderRadius: 2` writes `calc(2 * var(--mui-shape-borderRadius))`.
  const declared = ['calc(2 * var(--mui-shape-borderRadius, 8px))']

  test('is linked to the radius token with that factor', () => {
    const radius2: Token = { ...radius, id: 'shape.borderRadius.2', name: 'radius.2', value: '16px', factor: 2, code: 2 }
    expect(matchValue('radius', '16px', declared, [...tokens, radius2])).toEqual({ state: 'linked', token: radius2 })
  })

  test('is not linked to the radius token of factor 1 when no token has the factor', () => {
    expect(matchValue('radius', '16px', declared, tokens)).toEqual({ state: 'none', nearest: radius })
  })
})

describe('matchValue: a negative spacing', () => {
  test('is linked by the variable with the negative factor, and marked negative', () => {
    expect(matchValue('spacing', '-16px', ['calc(-2 * var(--mui-spacing, 8px))'], tokens)).toEqual({
      state: 'linked',
      token: spacing(2),
      negative: true,
    })
  })

  test('a fixed negative value equal to the size of a token is equal', () => {
    expect(matchValue('spacing', '-16px', ['-16px'], tokens)).toEqual({ state: 'equal', token: spacing(2), negative: true })
  })

  test('the nearest token is by size', () => {
    expect(matchValue('spacing', '-13px', [], tokens)).toEqual({ state: 'none', nearest: spacing(2), negative: true })
  })

  test('the positive factor does not link a negative value', () => {
    expect(matchValue('spacing', '-16px', ['calc(2 * var(--mui-spacing))'], tokens)).toEqual({
      state: 'equal',
      token: spacing(2),
      negative: true,
    })
  })
})

describe('matchValue: none', () => {
  test('the nearest token by px distance', () => {
    expect(matchValue('spacing', '13px', ['13px'], tokens)).toEqual({ state: 'none', nearest: spacing(2) })
    expect(matchValue('spacing', '11px', [], tokens)).toEqual({ state: 'none', nearest: spacing(1) })
  })

  test('the nearest token by color distance', () => {
    expect(matchValue('color', 'rgb(30, 80, 210)', [], tokens)).toEqual({ state: 'none', nearest: primary })
    expect(matchValue('color', 'rgb(250, 250, 250)', [], tokens)).toEqual({ state: 'none', nearest: white })
  })

  test('the nearest shadow has the nearest offsets', () => {
    expect(matchValue('shadow', '0px 2px 3px 0px rgba(16, 24, 40, 0.1)', [], tokens)).toEqual({
      state: 'none',
      nearest: shadow2,
    })
  })

  test('a shadow with a different number of layers has no nearest token', () => {
    const two = '0px 1px 2px 0px #000, 0px 1px 1px 0px #000'
    expect(matchValue('shadow', two, [], tokens)).toEqual({ state: 'none', nearest: null })
  })

  test('a group with no tokens has no nearest token', () => {
    expect(matchValue('stroke', '1px', ['1px'], tokens)).toEqual({ state: 'none', nearest: null })
  })

  test('an empty list of tokens gives none with no nearest token', () => {
    expect(matchValue('color', '#1f4fd8', ['var(--mui-palette-primary-main)'], [])).toEqual({
      state: 'none',
      nearest: null,
    })
    expect(matchValue('spacing', '16px', [], [])).toEqual({ state: 'none', nearest: null })
  })
})

describe('matchValue: no state', () => {
  test('a transparent color has no state', () => {
    expect(matchValue('color', 'rgba(0, 0, 0, 0)', [], tokens)).toBeNull()
    expect(matchValue('color', 'transparent', [], tokens)).toBeNull()
  })

  test('a zero length has no state', () => {
    expect(matchValue('spacing', '0px', [], tokens)).toBeNull()
    expect(matchValue('radius', '0', [], tokens)).toBeNull()
    expect(matchValue('stroke', '0px', [], tokens)).toBeNull()
  })

  test('no shadow has no state', () => {
    expect(matchValue('shadow', 'none', [], tokens)).toBeNull()
  })

  test('a value declared auto has no state', () => {
    // `mx: 'auto'`: the computed margin is the used length.
    expect(matchValue('spacing', '120px', ['auto'], tokens)).toBeNull()
  })

  test('a value that cannot be read has no state', () => {
    expect(matchValue('spacing', 'auto', [], tokens)).toBeNull()
    expect(matchValue('color', '', [], tokens)).toBeNull()
  })
})

describe('matchTextStyle', () => {
  const noClass = { texts: [], matches: () => false }

  test('linked by the class of the style when all five parts are equal', () => {
    const declared = { texts: ['16px', '400'], matches: (selector: string) => selector === '.MuiTypography-body1' }
    expect(matchTextStyle(body1Style, declared, tokens)).toEqual({ state: 'linked', token: body1 })
  })

  test('linked by a later selector of the list: a component that applies the style itself', () => {
    const button: Token = {
      id: 'typography.button',
      group: 'textStyle',
      name: 'button',
      value: { ...body1Style, fontSize: '14px', fontWeight: '600', lineHeight: '20.3px' },
      cssVar: '--mui-font-button',
      code: 'button',
      selector: '.MuiTypography-button, .MuiButton-root',
    }
    const computed = button.value as TextStyle
    // `matches` stands in for `Element.matches`, which accepts a selector list.
    const declared = {
      texts: ['14px', '600'],
      matches: (selector: string) => selector.split(',').some((part) => part.trim() === '.MuiButton-root'),
    }
    expect(matchTextStyle(computed, declared, [...tokens, button])).toEqual({ state: 'linked', token: button })
    expect(matchTextStyle(computed, noClass, [...tokens, button])).toEqual({ state: 'equal', token: button })
  })

  test('linked by the variable of the style in the declared font', () => {
    const declared = { texts: ['var(--mui-font-body1, 400 1rem/1.5 system-ui)'], matches: () => false }
    expect(matchTextStyle(body1Style, declared, tokens)).toEqual({ state: 'linked', token: body1 })
  })

  test('the class of a style with different parts does not link it', () => {
    const computed = { ...body1Style, lineHeight: '30px' }
    const declared = { texts: [], matches: (selector: string) => selector === '.MuiTypography-body1' }
    expect(matchTextStyle(computed, declared, tokens)).toEqual({ state: 'none', nearest: body1 })
  })

  test('equal in all five parts with no class and no variable', () => {
    const computed = { ...body1Style, fontFamily: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" }
    expect(matchTextStyle(computed, noClass, tokens)).toEqual({ state: 'equal', token: body1 })
  })

  test('none gives the nearest style: of two with the same count of different parts, the nearer size', () => {
    // body1 and caption both have two different parts; the size of caption is nearer.
    const computed = { ...(caption.value as TextStyle), fontSize: '13px', letterSpacing: 'normal' }
    expect(matchTextStyle(computed, noClass, tokens)).toEqual({ state: 'none', nearest: caption })
  })

  test('the style with the fewest different parts is the nearest', () => {
    const computed = { ...body1Style, fontSize: '17px', fontWeight: '600', lineHeight: '26.1px' }
    // body1: size and weight and line height differ (3); h6: size differs (1).
    expect(matchTextStyle(computed, noClass, tokens)).toEqual({ state: 'none', nearest: h6 })
  })

  test('an empty list of tokens gives none with no nearest style', () => {
    expect(matchTextStyle(body1Style, noClass, [])).toEqual({ state: 'none', nearest: null })
  })
})
