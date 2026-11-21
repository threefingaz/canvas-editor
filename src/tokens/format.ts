// The token format: the content of `tokens.json`, the one token file that the
// tool reads. The library folder writes it, and the editor and the Node tools
// read it. This module has no imports, thus each side can use it.

export const tokenGroups = ['color', 'spacing', 'radius', 'textStyle', 'shadow', 'stroke'] as const

export type TokenGroup = (typeof tokenGroups)[number]

// The five parts of a text style, each resolved to the form of a computed
// style: sizes in px, the weight as a number text.
export type TextStyle = {
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
}

export type Token = {
  // A unique id: 'palette.primary.main', 'spacing.2', 'typography.body1'.
  id: string
  group: TokenGroup
  // The name that the inspector shows.
  name: string
  // The resolved value: '#1f4fd8', '16px', or a text style.
  value: string | TextStyle
  // The CSS variable of the token: '--lib-color-primary'.
  cssVar?: string
  // For a token that the library writes as `factor * var(cssVar)`.
  factor?: number
  // How the library writes the token in code: 'primary.main', 2.
  code: string | number
  // For a text style: the class of the elements that use the style.
  selector?: string
  // The values of the token in ranges of widths, for a library whose token
  // values change with the width (a variable redefined in a media rule, or a
  // rem value with a different root size). Each `query` is a media
  // condition: `(width < 767px)`. The last entry whose condition holds in a
  // frame gives the value there; with none, `value` holds. See `tokensAt`.
  media?: TokenMediaValue[]
}

export type TokenMediaValue = { query: string; value: string | TextStyle }

// The parts of a text style, in the order of the format.
export const textStyleParts = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
] as const satisfies readonly (keyof TextStyle)[]

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// The text of a caught error: the message of an `Error`, else the value as a
// text.
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function parseValue(group: TokenGroup, value: unknown, fail: (problem: string) => never) {
  if (group !== 'textStyle') {
    if (typeof value !== 'string' || value === '') fail('has no text value')
    return value
  }
  if (!isRecord(value)) fail('has a value that is not a text style object')
  const style = {} as TextStyle
  for (const part of textStyleParts) {
    const text = value[part]
    if (typeof text !== 'string' || text === '') fail(`has no text style part "${part}"`)
    style[part] = text
  }
  return style
}

function parseToken(raw: unknown, index: number, seen: Set<string>): Token {
  const label = isRecord(raw) && typeof raw.id === 'string' && raw.id !== '' ? `"${raw.id}"` : ''
  const fail = (problem: string): never => {
    throw new Error(`tokens.json: token ${index + 1} ${label}${label ? ' ' : ''}${problem}`)
  }
  if (!isRecord(raw)) return fail('is not an object')

  const { id, group, name, value, cssVar, factor, code, selector, media } = raw
  if (typeof id !== 'string' || id === '') return fail('has no id')
  if (seen.has(id)) fail('is a duplicate id')
  if (!tokenGroups.includes(group as TokenGroup)) fail(`has an unknown group "${String(group)}"`)
  if (typeof name !== 'string' || name === '') fail('has no name')
  if (typeof code !== 'string' && typeof code !== 'number') fail('has no code (text or number)')
  if (cssVar !== undefined && (typeof cssVar !== 'string' || !cssVar.startsWith('--'))) {
    fail('has a cssVar that does not start with "--"')
  }
  if (factor !== undefined && (typeof factor !== 'number' || !Number.isFinite(factor))) {
    fail('has a factor that is not a number')
  }
  if (selector !== undefined && (typeof selector !== 'string' || selector === '')) {
    fail('has a selector that is not a text')
  }
  if (media !== undefined && !Array.isArray(media)) fail('has a media field that is not a list')

  const token: Token = {
    id,
    group: group as TokenGroup,
    name: name as string,
    value: parseValue(group as TokenGroup, value, fail),
    code: code as string | number,
  }
  if (cssVar !== undefined) token.cssVar = cssVar as string
  if (factor !== undefined) token.factor = factor as number
  if (selector !== undefined) token.selector = selector as string
  if (media !== undefined) {
    token.media = (media as unknown[]).map((entry, place) => {
      const at = (problem: string): never => fail(`has a media value ${place + 1} that ${problem}`)
      if (!isRecord(entry)) return at('is not an object')
      if (typeof entry.query !== 'string' || entry.query.trim() === '') return at('has no query')
      return { query: entry.query, value: parseValue(group as TokenGroup, entry.value, (problem) => at(problem)) }
    })
  }
  seen.add(id)
  return token
}

// Checks the content of `tokens.json` (the value after `JSON.parse`) and gives
// the tokens. An error names the token and the problem.
export function parseTokens(json: unknown): Token[] {
  if (!isRecord(json) || !Array.isArray(json.tokens)) {
    throw new Error('tokens.json: the file must be an object with a token list in "tokens"')
  }
  const seen = new Set<string>()
  return json.tokens.map((raw, index) => parseToken(raw, index, seen))
}

// The text of `tokens.json`. The fields keep the sequence in which the
// library folder builds each token.
export function formatTokens(tokens: readonly Token[]): string {
  return `${JSON.stringify({ tokens }, null, 2)}\n`
}

// The CSS text of a token, as the library writes it: `var(--x)`, or
// `calc(2 * var(--x))` for a token with a factor, or the plain value for a
// token with no variable. A text style with a variable gives the variable (a
// `font` shorthand); a text style with no variable has no single CSS text.
export function tokenCss(token: Token): string {
  if (token.cssVar) {
    const factor = token.factor ?? 1
    return factor === 1 ? `var(${token.cssVar})` : `calc(${factor} * var(${token.cssVar}))`
  }
  if (typeof token.value !== 'string') {
    throw new Error(`token "${token.id}" is a text style with no variable`)
  }
  return token.value
}

// The tokens with the values that hold where `holds` is true for a media
// condition: in a frame, the condition of its window. A token with no media
// value is the same object.
export function tokensAt(tokens: readonly Token[], holds: (query: string) => boolean): Token[] {
  return tokens.map((token) => {
    if (!token.media) return token
    let value = token.value
    for (const entry of token.media) {
      if (holds(entry.query)) value = entry.value
    }
    return value === token.value ? token : { ...token, value }
  })
}
