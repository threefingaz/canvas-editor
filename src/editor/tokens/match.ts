import { textStyleParts, type TextStyle, type Token, type TokenGroup } from '../../tokens/format.ts'
import { factorsOf, variablesIn } from './declarations.ts'
import {
  colorDistance,
  parseColor,
  parseLength,
  parseShadow,
  sameColor,
  sameLength,
  sameShadow,
  sameTextPart,
  shadowDistance,
  type Rgba,
  type ShadowLayer,
} from './normalize.ts'

// The state of a style value: linked to a token, equal to a token but not
// linked, or equal to no token (with the nearest token).
//
// The input is the computed value and the declared texts: the text of the
// declaration that wins (see `readStyles`), then the texts of the variables
// that it follows. A rule that matches the element but loses is not read,
// thus it cannot link a value.
//
// Limit, accepted for now: the reading does not calculate `@layer`. A rule in
// a layer is compared with the other rules by its specificity and its
// position, as if it were not in a layer.

export type ValueGroup = Exclude<TokenGroup, 'textStyle'>

// `negative`: a negative spacing (a negative margin), compared by its size
// with the token; the inspector shows the token with a minus sign.
export type ValueState =
  | { state: 'linked'; token: Token; negative?: true }
  | { state: 'equal'; token: Token; negative?: true }
  | { state: 'none'; nearest: Token | null; negative?: true }

type TextStylePart = keyof TextStyle

// The declared side of a text style: the winning texts of its five parts (a
// part that only `font` sets reads the text of `font`), with the variables
// that they follow, and a test of the element against the selector of a
// style.
export type TextDeclared = {
  texts: readonly string[]
  matches: (selector: string) => boolean
}

// How one kind of value is read, compared and measured.
type Kind<T> = {
  parse: (text: string) => T | null
  // True for a value that has no state: a transparent color, a zero length,
  // no shadow. The inspector does not show it as a value with no token.
  empty: (value: T) => boolean
  same: (a: T, b: T) => boolean
  distance: (a: T, b: T) => number
}

const colorKind: Kind<Rgba> = {
  parse: parseColor,
  empty: (color) => color.a === 0,
  same: sameColor,
  distance: colorDistance,
}

const lengthKind: Kind<number> = {
  parse: parseLength,
  empty: (length) => length === 0,
  same: sameLength,
  distance: (a, b) => Math.abs(a - b),
}

const shadowKind: Kind<ShadowLayer[]> = {
  parse: parseShadow,
  empty: (layers) => layers.length === 0,
  same: sameShadow,
  distance: shadowDistance,
}

const kinds: Record<ValueGroup, Kind<unknown>> = {
  color: colorKind as Kind<unknown>,
  spacing: lengthKind as Kind<unknown>,
  radius: lengthKind as Kind<unknown>,
  stroke: lengthKind as Kind<unknown>,
  shadow: shadowKind as Kind<unknown>,
}

// True when a declared text has the variable of the token with its factor (1
// for a token with no factor), times `sign`.
function declares(token: Token, declared: readonly string[], sign: 1 | -1): boolean {
  const cssVar = token.cssVar
  if (!cssVar) return false
  const factor = sign * (token.factor ?? 1)
  return declared.some((text) => factorsOf(text, cssVar).includes(factor))
}

// The state of one value of a group. Null when the value has no state (see
// `empty`), cannot be read, or is declared `auto` (a margin: the computed
// value is the used length, which no token sets).
//
// A negative spacing is compared by its size, and links the token whose
// variable it has with the negative factor: `m: -2` writes
// `calc(-2 * var(--lib-spacing))`.
export function matchValue(
  group: ValueGroup,
  computed: string,
  declared: readonly string[],
  tokens: readonly Token[],
): ValueState | null {
  if (declared.some((text) => text.toLowerCase() === 'auto')) return null
  const kind = kinds[group]
  const parsed = kind.parse(computed)
  if (parsed === null || kind.empty(parsed)) return null
  const sign = group === 'spacing' && (parsed as number) < 0 ? -1 : 1
  const value = sign === -1 ? -(parsed as number) : parsed
  const negative = sign === -1 ? { negative: true as const } : {}

  const candidates: { token: Token; value: unknown }[] = []
  for (const token of tokens) {
    if (token.group !== group || typeof token.value !== 'string') continue
    const tokenValue = kind.parse(token.value)
    if (tokenValue !== null) candidates.push({ token, value: tokenValue })
  }

  const same = candidates.filter((candidate) => kind.same(candidate.value, value))
  // The token of the text nearest to the element wins: in
  // `--text-caption: var(--gray-400)` the semantic token links, not the
  // palette token with the same value.
  const linked = declared
    .map((text) => same.find((candidate) => declares(candidate.token, [text], sign)))
    .find((candidate) => candidate !== undefined)
  if (linked) return { state: 'linked', token: linked.token, ...negative }
  if (same.length > 0) return { state: 'equal', token: same[0].token, ...negative }

  let nearest: Token | null = null
  let best = Infinity
  for (const candidate of candidates) {
    const distance = kind.distance(candidate.value, value)
    if (distance < best) {
      best = distance
      nearest = candidate.token
    }
  }
  return { state: 'none', nearest, ...negative }
}

function differentParts(computed: TextStyle, style: TextStyle): TextStylePart[] {
  return textStyleParts.filter((part) => !sameTextPart(part, computed[part], style[part]))
}

function sizeDistance(computed: TextStyle, style: TextStyle) {
  const a = parseLength(computed.fontSize)
  const b = parseLength(style.fontSize)
  return a === null || b === null ? Infinity : Math.abs(a - b)
}

// The state of the text style of an element. Linked: the declared texts have
// the variable of a style, or the element matches the selector of a style;
// and all five computed parts are equal to the style. Equal: all five parts
// are equal to a style with no such evidence. None: the nearest style is the
// one with the fewest different parts, then the nearest font size.
export function matchTextStyle(computed: TextStyle, declared: TextDeclared, tokens: readonly Token[]): ValueState {
  const styles = tokens.filter(
    (token): token is Token & { value: TextStyle } => token.group === 'textStyle' && typeof token.value === 'object',
  )
  const ranked = styles.map((token) => ({ token, different: differentParts(computed, token.value) }))

  const same = ranked.filter((entry) => entry.different.length === 0)
  const linked = same.find(({ token }) => {
    const byVariable = token.cssVar !== undefined && declared.texts.some((text) => variablesIn(text).includes(token.cssVar!))
    return byVariable || (token.selector !== undefined && declared.matches(token.selector))
  })
  if (linked) return { state: 'linked', token: linked.token }
  if (same.length > 0) return { state: 'equal', token: same[0].token }

  let nearest: (typeof ranked)[number] | null = null
  for (const entry of ranked) {
    if (
      !nearest ||
      entry.different.length < nearest.different.length ||
      (entry.different.length === nearest.different.length &&
        sizeDistance(computed, entry.token.value) < sizeDistance(computed, nearest.token.value))
    ) {
      nearest = entry
    }
  }
  return { state: 'none', nearest: nearest?.token ?? null }
}
