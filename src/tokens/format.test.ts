import { describe, expect, test } from 'vitest'
import { formatTokens, messageOf, parseTokens, tokenCss, tokensAt, type Token } from './format.ts'

const bodyStyle = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: '16px',
  fontWeight: '400',
  lineHeight: '24px',
  letterSpacing: '0px',
}

const tokens: Token[] = [
  {
    id: 'palette.primary.main',
    group: 'color',
    name: 'primary.main',
    value: '#1f4fd8',
    cssVar: '--mui-palette-primary-main',
    code: 'primary.main',
  },
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
    id: 'typography.body1',
    group: 'textStyle',
    name: 'body1',
    value: bodyStyle,
    cssVar: '--mui-font-body1',
    code: 'body1',
    selector: '.MuiTypography-body1',
  },
]

// A copy of the file content, with one token changed by `change`.
function fileWith(index: number, change: (token: Record<string, unknown>) => void) {
  const copy = structuredClone(tokens) as unknown as Record<string, unknown>[]
  change(copy[index])
  return { tokens: copy }
}

describe('messageOf', () => {
  test('gives the message of an error, else the value as a text', () => {
    expect(messageOf(new Error('no file'))).toBe('no file')
    expect(messageOf(new TypeError('not a function'))).toBe('not a function')
    expect(messageOf('a text')).toBe('a text')
    expect(messageOf(404)).toBe('404')
  })
})

describe('parseTokens', () => {
  test('gives the tokens of a correct file', () => {
    expect(parseTokens({ tokens })).toEqual(tokens)
  })

  test('accepts a token with no optional fields', () => {
    const plain = { id: 'radius', group: 'radius', name: 'radius', value: '8px', code: 1 }
    expect(parseTokens({ tokens: [plain] })).toEqual([plain])
  })

  test('gives the same tokens after formatTokens and JSON.parse', () => {
    expect(parseTokens(JSON.parse(formatTokens(tokens)))).toEqual(tokens)
  })

  test('rejects a file that is not an object with a token list', () => {
    expect(() => parseTokens(null)).toThrow(/token list/)
    expect(() => parseTokens([])).toThrow(/token list/)
    expect(() => parseTokens({ tokens: {} })).toThrow(/token list/)
  })

  test('rejects a code that is not a finite number: the file would give null', () => {
    for (const code of [Number.NaN, Number.NEGATIVE_INFINITY]) {
      const file = fileWith(0, (token) => (token.code = code))
      expect(() => parseTokens(file), String(code)).toThrow(/has no code/)
    }
  })

  test('rejects an unknown group and names the token', () => {
    const file = fileWith(0, (token) => (token.group = 'border'))
    expect(() => parseTokens(file)).toThrow(/palette\.primary\.main.*group "border"/)
  })

  test('rejects a missing id and names the token by its place', () => {
    const file = fileWith(1, (token) => delete token.id)
    expect(() => parseTokens(file)).toThrow(/token 2 .*id/)
  })

  test('rejects a duplicate id and names the token', () => {
    const file = fileWith(1, (token) => (token.id = 'palette.primary.main'))
    expect(() => parseTokens(file)).toThrow(/palette\.primary\.main.*duplicate/)
  })

  test('rejects a text style with a missing part and names the token and the part', () => {
    const file = fileWith(2, (token) => delete (token.value as Record<string, unknown>).lineHeight)
    expect(() => parseTokens(file)).toThrow(/typography\.body1.*lineHeight/)
  })

  test('rejects a text value for a text style, and an object value for a color', () => {
    expect(() => parseTokens(fileWith(2, (token) => (token.value = '16px')))).toThrow(
      /typography\.body1.*value/,
    )
    expect(() => parseTokens(fileWith(0, (token) => (token.value = bodyStyle)))).toThrow(
      /palette\.primary\.main.*value/,
    )
  })

  test('rejects fields of the wrong type and names the token', () => {
    expect(() => parseTokens(fileWith(0, (token) => (token.code = true)))).toThrow(
      /palette\.primary\.main.*code/,
    )
    expect(() => parseTokens(fileWith(1, (token) => (token.factor = '2')))).toThrow(
      /spacing\.2.*factor/,
    )
    expect(() => parseTokens(fileWith(0, (token) => (token.cssVar = 'primary')))).toThrow(
      /palette\.primary\.main.*cssVar/,
    )
    expect(() => parseTokens(fileWith(0, (token) => delete token.name))).toThrow(
      /palette\.primary\.main.*name/,
    )
  })
})

describe('parseTokens: media values', () => {
  test('keeps the media values of a token', () => {
    const file = fileWith(1, (token) => (token.media = [{ query: '(width < 767px)', value: '12px' }]))
    expect(parseTokens(file)[1].media).toEqual([{ query: '(width < 767px)', value: '12px' }])
    const style = fileWith(2, (token) => (token.media = [{ query: '(width < 768px)', value: { ...bodyStyle, fontSize: '14px' } }]))
    expect(parseTokens(style)[2].media?.[0].value).toMatchObject({ fontSize: '14px' })
  })

  test('rejects media values that are not correct and names the token', () => {
    expect(() => parseTokens(fileWith(1, (token) => (token.media = '12px')))).toThrow(/spacing\.2.*media field/)
    expect(() => parseTokens(fileWith(1, (token) => (token.media = [{ value: '12px' }])))).toThrow(
      /spacing\.2.*media value 1 that has no query/,
    )
    expect(() => parseTokens(fileWith(2, (token) => (token.media = [{ query: '(width < 1px)', value: '14px' }])))).toThrow(
      /typography\.body1.*media value 1/,
    )
  })
})

describe('tokensAt', () => {
  const responsive: Token = {
    ...tokens[1],
    media: [
      { query: '(width < 768px)', value: '12.8px' },
      { query: '(width < 767px)', value: '9.6px' },
    ],
  }

  test('the last media value whose condition holds gives the value', () => {
    expect(tokensAt([responsive], () => true)[0].value).toBe('9.6px')
    expect(tokensAt([responsive], (query) => query === '(width < 768px)')[0].value).toBe('12.8px')
  })

  test('with no condition that holds, and for a token with no media values, the token is the same', () => {
    expect(tokensAt([responsive], () => false)[0]).toBe(responsive)
    expect(tokensAt(tokens, () => true)[0]).toBe(tokens[0])
  })
})

describe('formatTokens', () => {
  test('writes one stable text with a final line break', () => {
    const text = formatTokens(tokens)
    expect(text).toBe(formatTokens(structuredClone(tokens)))
    expect(text.endsWith('}\n')).toBe(true)
  })
})

describe('tokenCss', () => {
  const color = tokens[0]
  const spacing = tokens[1]

  test('gives the variable of a token with a variable', () => {
    expect(tokenCss(color)).toBe('var(--mui-palette-primary-main)')
  })

  test('gives the factor times the variable for a token with a factor', () => {
    expect(tokenCss(spacing)).toBe('calc(2 * var(--mui-spacing))')
  })

  test('gives the plain variable for the factor 1', () => {
    expect(tokenCss({ ...spacing, factor: 1 })).toBe('var(--mui-spacing)')
  })

  test('keeps a negative factor', () => {
    expect(tokenCss({ ...spacing, factor: -2 })).toBe('calc(-2 * var(--mui-spacing))')
    expect(tokenCss({ ...spacing, factor: -0.5 })).toBe('calc(-0.5 * var(--mui-spacing))')
  })

  test('gives the plain value of a token with no variable', () => {
    const plain: Token = { id: 'radius', group: 'radius', name: 'radius', value: '8px', code: 1 }
    expect(tokenCss(plain)).toBe('8px')
  })

  test('rejects a text style with no variable', () => {
    const { cssVar: _, ...plain } = tokens[2]
    expect(() => tokenCss(plain)).toThrow(/typography\.body1/)
  })
})
