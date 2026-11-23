import { describe, expect, test } from 'vitest'
import { parseTokens, type TextStyle } from './format.ts'
import { cssPartsOf, tokensFromObject, valueAt } from './from-object.ts'

const theme = {
  palette: {
    primary: { main: '#1f4fd8', mainChannel: '31 79 216', contrastText: '#fff' },
    divider: '#e4e7ec',
    action: { hover: 'rgba(0, 0, 0, 0.04)', hoverOpacity: 0.04 },
  },
  vars: {
    palette: {
      primary: { main: 'var(--lib-primary-main, #1f4fd8)' },
      divider: 'var(--lib-divider)',
    },
  },
  space: { '0.5': 4, '1': 8, '2': 16 },
  radius: { small: '4px', large: '1rem' },
  shadows: ['none', '0 1px 2px #0002'],
  type: {
    body: { size: 16, weight: 400, line: 24 },
    title: { size: 24, weight: 700, line: 32 },
  },
}

describe('tokensFromObject', () => {
  test('gives the colors of a path and of its children, with the code and the variable', () => {
    const tokens = tokensFromObject(theme, {
      color: {
        paths: ['palette.primary', 'palette.divider', 'palette.action'],
        code: (path) => path.slice(1).join('.'),
        css: (path) => valueAt(theme.vars, path),
      },
    })
    expect(tokens).toEqual([
      {
        id: 'palette.primary.main',
        group: 'color',
        name: 'primary.main',
        value: '#1f4fd8',
        cssVar: '--lib-primary-main',
        code: 'primary.main',
      },
      { id: 'palette.primary.contrastText', group: 'color', name: 'primary.contrastText', value: '#fff', code: 'primary.contrastText' },
      { id: 'palette.divider', group: 'color', name: 'divider', value: '#e4e7ec', cssVar: '--lib-divider', code: 'divider' },
      { id: 'palette.action.hover', group: 'color', name: 'action.hover', value: 'rgba(0, 0, 0, 0.04)', code: 'action.hover' },
    ])
  })

  test('gives numbers as px, keeps the sequence of the paths, and takes a key with a dot', () => {
    const tokens = tokensFromObject(theme, {
      spacing: {
        paths: [['space', '0.5'], 'space.1', 'space.2'],
        id: (path) => `spacing.${path[1]}`,
        code: (path) => Number(path[1]),
        css: (path) => `calc(${path[1]} * var(--lib-space))`,
      },
    })
    expect(tokens.map((token) => [token.id, token.name, token.value, token.code, token.factor])).toEqual([
      ['spacing.0.5', 'spacing.0.5', '4px', 0.5, 0.5],
      ['spacing.1', 'spacing.1', '8px', 1, undefined],
      ['spacing.2', 'spacing.2', '16px', 2, 2],
    ])
    expect(tokens[0].cssVar).toBe('--lib-space')
  })

  test('takes `*` for each key of a level, and leaves out a value that is no token of the group', () => {
    const tokens = tokensFromObject(theme, { radius: { paths: ['radius.*'] }, shadow: { paths: ['shadows.*'] } })
    expect(tokens.map((token) => [token.id, token.group, token.value])).toEqual([
      ['radius.small', 'radius', '4px'],
      ['shadows.1', 'shadow', '0 1px 2px #0002'],
    ])
  })

  test('gives text styles with the function of the group, and their selector', () => {
    const style = (node: unknown): TextStyle | null => {
      const part = node as { size?: number; weight?: number; line?: number }
      if (typeof part.size !== 'number') return null
      return {
        fontFamily: 'system-ui',
        fontSize: `${part.size}px`,
        fontWeight: String(part.weight),
        lineHeight: `${part.line}px`,
        letterSpacing: 'normal',
      }
    }
    const tokens = tokensFromObject(theme, {
      textStyle: { paths: ['type'], value: style, code: (path) => path[1], selector: (path) => `.text-${path[1]}` },
    })
    expect(tokens.map((token) => [token.id, token.code, token.selector])).toEqual([
      ['type.body', 'body', '.text-body'],
      ['type.title', 'title', '.text-title'],
    ])
    expect(tokens[1].value).toMatchObject({ fontSize: '24px', fontWeight: '700' })
    expect(parseTokens({ tokens })).toEqual(tokens)
  })

  test('a text style group with no value function is an error', () => {
    expect(() => tokensFromObject(theme, { textStyle: { paths: ['type'] } })).toThrow(/needs a function "value"/)
  })

  test('two paths with one id are an error', () => {
    expect(() => tokensFromObject(theme, { color: { paths: ['palette.divider', 'palette.divider'] } })).toThrow(
      /two paths give the token "palette.divider"/,
    )
  })

  test('a path that the object does not have gives no token, and a loop in the object ends', () => {
    const loop: Record<string, unknown> = { name: 'loop' }
    loop.self = loop
    expect(tokensFromObject({ loop }, { color: { paths: ['palette.none', 'loop'] } })).toEqual([])
  })
})

describe('cssPartsOf', () => {
  test('reads the variable and the factor of a CSS text', () => {
    expect(cssPartsOf('var(--x)')).toEqual({ cssVar: '--x' })
    expect(cssPartsOf('var(--x, 8px)')).toEqual({ cssVar: '--x' })
    expect(cssPartsOf('calc(2 * var(--x, 8px))')).toEqual({ cssVar: '--x', factor: 2 })
    expect(cssPartsOf('calc(var(--x) * 0.5)')).toEqual({ cssVar: '--x', factor: 0.5 })
    expect(cssPartsOf('calc(1 * var(--x))')).toEqual({ cssVar: '--x' })
    expect(cssPartsOf('8px')).toEqual({})
    expect(cssPartsOf(undefined)).toEqual({})
  })
})

describe('valueAt', () => {
  test('gives the value at a path, or undefined', () => {
    expect(valueAt(theme, ['palette', 'primary', 'main'])).toBe('#1f4fd8')
    expect(valueAt(theme, ['palette', 'none', 'main'])).toBeUndefined()
  })
})
