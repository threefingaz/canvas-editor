import type { Token, TokenGroup, TokenMediaValue } from './format.ts'

// The tokens of a stylesheet: each custom property of the root rules
// (`:root`, `html`, `:host`) becomes a token. A token entry of a pack calls it
// with the text of the stylesheet of the library:
//
//   tokensFromCss(readFileSync(require.resolve('<library>/styles.css'), 'utf8'))
//
// The reader is a small one of its own, not a CSS package: the token entry
// runs in Node, in the tool and in a host, and the tool adds no package for
// it. It reads comments, strings, nested rules and the at-rules `@media` and
// `@layer`; each other at-rule (`@font-face`, `@keyframes`, `@supports`) is
// left out. It reads what a library writes for its variables, not each form
// of CSS.
//
// The value of a token is the value in the form of a computed style: each
// `var()` is followed (an alias such as `--widget-radius: var(--radius-xl)`
// gets the value of `--radius-xl`), each rem length becomes px with the root
// font size of the stylesheet, and a `calc()` of px and numbers is computed.
// A variable or a root font size that a media rule redefines gives the token
// `media` values, one for each media condition with a different value.
//
// Media conditions can overlap: `(width < 767px)` holds only where
// `(width < 768px)` holds too. The values of a condition are computed with
// each declaration of a wider condition, as the cascade does, and the `media`
// list has a wider condition before a narrower one, thus the last entry that
// holds in a frame (`tokensAt`) is the value of the page. This is done for the
// conditions of the width that can be compared (`widthRange`); each other
// condition stands alone, with the declarations of its own text only.

export type CssTokenRule = {
  // Tested on the name of the variable, with its `--`.
  match: RegExp
  // The group of each variable that matches; null leaves it out. A text style
  // has five parts and cannot come from one variable.
  group: Exclude<TokenGroup, 'textStyle'> | null
}

export type CssTokenOptions = {
  // The name rules, before the rules of the tool. The first rule that matches
  // decides.
  rules?: readonly CssTokenRule[]
  // How the library writes the token in code. Default: `var(--name)`.
  code?: (name: string) => string | number
  // The root font size of the browser, in px, for the rem lengths. Default 16.
  rootFontSize?: number
  // The selectors of the root rules. Default: `:root`, `html`, `:host`.
  rootSelectors?: readonly string[]
}

// A custom property of the root rules with its resolved value. `media` has one
// entry for each media condition of the root rules (not only where the value
// differs), in one sequence for all variables, thus the parts of a text style
// can be joined by the condition. The last entry whose condition holds gives
// the value, as for a token.
export type CssVariable = { value: string; media: { query: string; value: string }[] }

export type CssVariableOptions = Pick<CssTokenOptions, 'rootFontSize' | 'rootSelectors'>

type Declaration = { property: string; value: string; media: string }

const defaultRootSelectors = [':root', 'html', ':host']

// The rules of the tool, after the rules of the options: a group from the
// kind of the value and from the words of the name. A length with a name that
// says none of these (a font size, a width) is left out.
const radiusName = /radius|rounded|corner/i
const strokeName = /border-width|stroke|outline-width|line-width/i
const spacingName = /space|spacing|gap|gutter|padding|margin|inset/i
const shadowName = /shadow|elevation/i

const colorKeywords = new Set(['transparent', 'black', 'white'])

// A color text: hex, a color function, or one of the keywords that the editor
// reads (`transparent`, `black`, `white`).
export function isColorText(text: string): boolean {
  const value = text.trim().toLowerCase()
  return (
    /^#[0-9a-f]{3,8}$/.test(value) ||
    /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(.*\)$/.test(value) ||
    colorKeywords.has(value)
  )
}

const lengthPattern = /^-?\d*\.?\d+px$|^0$/

function isLength(text: string) {
  return lengthPattern.test(text.trim())
}

function px(value: number) {
  const rounded = Number(value.toFixed(3))
  return `${rounded === 0 ? 0 : rounded}px`
}

// --- The reader -------------------------------------------------------------

function withoutComments(css: string): string {
  let out = ''
  let quote = ''
  for (let index = 0; index < css.length; index++) {
    const char = css[index]
    if (quote) {
      out += char
      if (char === '\\') out += css[++index] ?? ''
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") quote = char
    if (char === '/' && css[index + 1] === '*') {
      const end = css.indexOf('*/', index + 2)
      index = end === -1 ? css.length : end + 1
      out += ' '
      continue
    }
    out += char
  }
  return out
}

// Reads from `start` to the first `;`, `{` or `}` outside a string and outside
// brackets. Gives the text and the character that ended it ('' at the end).
function readUntil(css: string, start: number): { text: string; end: number; stop: string } {
  let depth = 0
  let quote = ''
  for (let index = start; index < css.length; index++) {
    const char = css[index]
    if (quote) {
      if (char === '\\') index++
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1)
    else if (depth === 0 && (char === ';' || char === '{' || char === '}')) {
      return { text: css.slice(start, index), end: index, stop: char }
    }
  }
  return { text: css.slice(start), end: css.length, stop: '' }
}

// The end of the block that starts after the `{` at `open - 1`: the index of
// its `}`.
function blockEnd(css: string, open: number): number {
  let depth = 1
  let index = open
  while (index < css.length) {
    const part = readUntil(css, index)
    if (part.stop === '') return css.length
    if (part.stop === '{') depth++
    if (part.stop === '}') depth--
    if (depth === 0) return part.end
    index = part.end + 1
  }
  return css.length
}

function collapse(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function joinMedia(outer: string, inner: string) {
  if (!outer) return inner
  if (!inner) return outer
  return `${outer} and ${inner}`
}

type Scope = { root: boolean; inRule: boolean; media: string }

function isRootRule(prelude: string, scope: Scope, rootSelectors: readonly string[]) {
  const parts = prelude.split(',').map(collapse)
  if (scope.inRule) return scope.root && parts.every((part) => part === '&')
  return parts.some((part) => rootSelectors.includes(part))
}

// Each declaration of a root rule, in the sequence of the stylesheet, with the
// media condition that holds around it ('' for none).
function rootDeclarations(css: string, rootSelectors: readonly string[]): Declaration[] {
  const text = withoutComments(css)
  const list: Declaration[] = []

  const walk = (start: number, end: number, scope: Scope) => {
    let index = start
    while (index < end) {
      const part = readUntil(text, index)
      const stop = part.end >= end ? '' : part.stop
      const prelude = text.slice(index, Math.min(part.end, end))
      if (stop === '{') {
        const close = blockEnd(text, part.end + 1)
        const head = collapse(prelude)
        const at = /^@([\w-]+)\s*(.*)$/s.exec(head)
        if (at) {
          const name = at[1].toLowerCase()
          if (name === 'media') walk(part.end + 1, close, { ...scope, media: joinMedia(scope.media, collapse(at[2])) })
          else if (name === 'layer') walk(part.end + 1, close, scope)
        } else {
          const root = isRootRule(head, scope, rootSelectors)
          walk(part.end + 1, close, { root, inRule: true, media: scope.media })
        }
        index = close + 1
        continue
      }
      if (scope.root) {
        const colon = prelude.indexOf(':')
        if (colon > 0) {
          const property = prelude.slice(0, colon).trim()
          const value = prelude
            .slice(colon + 1)
            .replace(/!\s*important\s*$/i, '')
            .trim()
          if (/^--[\w-]+$/.test(property) || property.toLowerCase() === 'font-size') {
            list.push({ property: property.startsWith('--') ? property : 'font-size', value, media: scope.media })
          }
        }
      }
      if (stop === '') return
      index = part.end + 1
    }
  }

  walk(0, text.length, { root: false, inRule: false, media: '' })
  return list
}

// --- The values -------------------------------------------------------------

// The arguments of a function call that starts at `open` (the index of its
// `(`), split at the top commas, and the index of its `)`.
function callArguments(text: string, open: number): { args: string[]; close: number } | null {
  let depth = 0
  let from = open + 1
  const args: string[] = []
  for (let index = open; index < text.length; index++) {
    const char = text[index]
    if (char === '(') depth++
    else if (char === ')') {
      depth--
      if (depth === 0) {
        args.push(text.slice(from, index))
        return { args, close: index }
      }
    } else if (char === ',' && depth === 1 && args.length === 0) {
      args.push(text.slice(from, index))
      from = index + 1
    }
  }
  return null
}

// The text with each `var()` replaced, or null when a variable has no value
// and no fallback, or a chain comes back to itself.
function substitute(text: string, lookup: (name: string, seen: Set<string>) => string | null, seen: Set<string>): string | null {
  let out = ''
  let index = 0
  while (index < text.length) {
    const found = text.indexOf('var(', index)
    if (found === -1) {
      out += text.slice(index)
      break
    }
    out += text.slice(index, found)
    const call = callArguments(text, found + 3)
    if (!call) return null
    const name = call.args[0].trim()
    let value = lookup(name, seen)
    if (value === null && call.args.length > 1) value = substitute(call.args[1].trim(), lookup, seen)
    if (value === null) return null
    out += value
    index = call.close + 1
  }
  return out
}

// A `calc()` of px lengths and numbers, with `+ - * /` and brackets, as px or
// a number. Null for each other content.
function computeCalc(expression: string): string | null {
  const tokens = expression.match(/-?\d*\.?\d+(?:px)?|[-+*/()]|\S+/g) ?? []
  let place = 0
  type Amount = { value: number; length: boolean }

  const primary = (): Amount | null => {
    const token = tokens[place++]
    if (token === '(') {
      const inner = sum()
      if (tokens[place++] !== ')') return null
      return inner
    }
    if (token === undefined || !/^-?\d*\.?\d+(px)?$/.test(token)) return null
    return { value: parseFloat(token), length: token.endsWith('px') }
  }
  const product = (): Amount | null => {
    let left = primary()
    while (left && (tokens[place] === '*' || tokens[place] === '/')) {
      const op = tokens[place++]
      const right = primary()
      if (!right) return null
      if (op === '*') {
        if (left.length && right.length) return null
        left = { value: left.value * right.value, length: left.length || right.length }
      } else {
        if (right.length || right.value === 0) return null
        left = { value: left.value / right.value, length: left.length }
      }
    }
    return left
  }
  const sum = (): Amount | null => {
    let left = product()
    while (left && (tokens[place] === '+' || tokens[place] === '-')) {
      const op = tokens[place++]
      const right = product()
      if (!right || right.length !== left.length) return null
      left = { value: op === '+' ? left.value + right.value : left.value - right.value, length: left.length }
    }
    return left
  }

  const result = sum()
  if (!result || place !== tokens.length) return null
  return result.length ? px(result.value) : String(Number(result.value.toFixed(3)))
}

function finish(text: string, rootSize: number): string {
  let value = collapse(text).replace(/(^|[\s(,+*/-])(-?\d*\.?\d+)rem\b/g, (_, before: string, amount: string) => {
    return `${before}${px(Number(amount) * rootSize)}`
  })
  // A calc in a calc (from an alias) is a bracket in the outer calc.
  for (;;) {
    const found = /calc\(/i.exec(value)
    if (!found) break
    const call = callArguments(value, found.index + 4)
    if (!call || call.args.length !== 1) break
    const computed = computeCalc(call.args[0].replace(/calc\(/gi, '('))
    if (computed === null) break
    value = value.slice(0, found.index) + computed + value.slice(call.close + 1)
  }
  return value
}

// The root font size in px from the text of a `font-size` of the root rule.
function rootSizeOf(text: string | undefined, base: number): number {
  if (!text) return base
  const match = /^(\d*\.?\d+)(px|rem|em|%)$/.exec(text.trim())
  if (!match) return base
  const amount = Number(match[1])
  if (match[2] === 'px') return amount
  if (match[2] === '%') return (amount / 100) * base
  return amount * base
}

// --- The media conditions ---------------------------------------------------

// The range of widths of a media condition, in px.
export type WidthRange = { min: number; minOpen: boolean; max: number; maxOpen: boolean }

const everyWidth: WidthRange = { min: -Infinity, minOpen: false, max: Infinity, maxOpen: false }
const mediaLength = String.raw`(\d*\.?\d+)(px|em|rem)?`
const namedWidth = new RegExp(`^(min|max)-width\\s*:\\s*${mediaLength}$`)
const widthFirst = new RegExp(`^width\\s*(<=|>=|<|>)\\s*${mediaLength}$`)
const widthLast = new RegExp(`^${mediaLength}\\s*(<=|>=|<|>)\\s*width$`)
const widthBetween = new RegExp(`^${mediaLength}\\s*(<=|>=|<|>)\\s*width\\s*(<=|>=|<|>)\\s*${mediaLength}$`)

// A length of a media condition in px. An em and a rem are 16px there: a media
// condition does not read the font size of the page.
function mediaPx(amount: string, unit: string | undefined): number | null {
  const value = Number(amount)
  if (unit === undefined) return value === 0 ? 0 : null
  return unit === 'px' ? value : value * 16
}

// `width <op> limit` as a range.
function sideRange(op: string, limit: number | null): WidthRange | null {
  if (limit === null) return null
  if (op.startsWith('<')) return { ...everyWidth, max: limit, maxOpen: op === '<' }
  return { ...everyWidth, min: limit, minOpen: op === '>' }
}

const flipped: Record<string, string> = { '<': '>', '<=': '>=', '>': '<', '>=': '<=' }

function meet(a: WidthRange | null, b: WidthRange | null): WidthRange | null {
  if (!a || !b) return null
  const min = Math.max(a.min, b.min)
  const max = Math.min(a.max, b.max)
  return {
    min,
    minOpen: (a.min === min && a.minOpen) || (b.min === min && b.minOpen),
    max,
    maxOpen: (a.max === max && a.maxOpen) || (b.max === max && b.maxOpen),
  }
}

function featureRange(feature: string): WidthRange | null {
  const named = namedWidth.exec(feature)
  if (named) return sideRange(named[1] === 'max' ? '<=' : '>=', mediaPx(named[2], named[3]))
  const first = widthFirst.exec(feature)
  if (first) return sideRange(first[1], mediaPx(first[2], first[3]))
  const last = widthLast.exec(feature)
  if (last) return sideRange(flipped[last[3]], mediaPx(last[1], last[2]))
  const between = widthBetween.exec(feature)
  if (between) {
    return meet(
      sideRange(flipped[between[3]], mediaPx(between[1], between[2])),
      sideRange(between[4], mediaPx(between[5], between[6])),
    )
  }
  return null
}

// The range of widths where a media condition holds, or null for a condition
// that is not only about the width: `(width < 767px)`, `(max-width: 48em)`,
// `(600px <= width < 900px)`, and such parts joined with `and`. A media type,
// a different feature, `not`, `or`, a list with commas and a range with no
// width give null.
export function widthRange(query: string): WidthRange | null {
  let range: WidthRange | null = everyWidth
  for (const part of query.trim().toLowerCase().split(/\s+and\s+/)) {
    const feature = /^\(([^()]*)\)$/.exec(part.trim())
    if (!feature) return null
    range = meet(range, featureRange(feature[1].trim()))
    if (!range) return null
  }
  if (range.min > range.max || (range.min === range.max && (range.minOpen || range.maxOpen))) return null
  return range
}

// True when `inner` holds only where `outer` holds.
function contains(outer: WidthRange, inner: WidthRange): boolean {
  const low = outer.min < inner.min || (outer.min === inner.min && (!outer.minOpen || inner.minOpen))
  const high = outer.max > inner.max || (outer.max === inner.max && (!outer.maxOpen || inner.maxOpen))
  return low && high
}

function overlaps(a: WidthRange, b: WidthRange): boolean {
  const range = meet(a, b)
  return range !== null && (range.min < range.max || (range.min === range.max && !range.minOpen && !range.maxOpen))
}

// True when the condition `outer` holds at each width where `inner` holds:
// the same text, or two conditions of the width with one range in the other.
export function mediaHoldsWithin(outer: string, inner: string): boolean {
  if (outer === inner) return true
  const outerRange = widthRange(outer)
  const innerRange = widthRange(inner)
  return outerRange !== null && innerRange !== null && contains(outerRange, innerRange)
}

// The media conditions in the sequence of a `media` list: the sequence that
// they have, but a condition that holds in a part of a different one comes
// after it. The last entry that holds is then the narrowest.
export function orderMedia(queries: readonly string[]): string[] {
  const rest = [...queries]
  const ordered: string[] = []
  while (rest.length > 0) {
    const next = rest.findIndex((query) => {
      return !rest.some((other) => other !== query && mediaHoldsWithin(other, query) && !mediaHoldsWithin(query, other))
    })
    ordered.push(...rest.splice(Math.max(next, 0), 1))
  }
  return ordered
}

// The declarations that hold in a context: those with no media condition,
// those of the condition `media`, and those of each condition that holds
// wherever `media` holds; a later one wins, as in the stylesheet.
function contextValues(declarations: readonly Declaration[], media: string): Map<string, string> {
  const values = new Map<string, string>()
  const within = new Map<string, boolean>()
  for (const declaration of declarations) {
    let holds = declaration.media === '' || declaration.media === media
    if (!holds && media !== '') {
      const known = within.get(declaration.media)
      holds = known ?? mediaHoldsWithin(declaration.media, media)
      within.set(declaration.media, holds)
    }
    if (holds) values.set(declaration.property, declaration.value)
  }
  return values
}

function resolveAll(declarations: readonly Declaration[], media: string, base: number): Map<string, string> {
  const raw = contextValues(declarations, media)
  const rootSize = rootSizeOf(raw.get('font-size'), base)
  const lookup = (name: string, seen: Set<string>): string | null => {
    const text = raw.get(name)
    if (text === undefined || seen.has(name)) return null
    return substitute(text, lookup, new Set([...seen, name]))
  }
  const resolved = new Map<string, string>()
  for (const name of raw.keys()) {
    if (!name.startsWith('--')) continue
    const text = lookup(name, new Set())
    if (text !== null && text !== '') resolved.set(name, finish(text, rootSize))
  }
  return resolved
}

function groupOf(name: string, value: string, rules: readonly CssTokenRule[]): TokenGroup | null {
  for (const rule of rules) {
    if (rule.match.test(name)) return rule.group
  }
  if (isColorText(value)) return 'color'
  if (shadowName.test(name) && value !== 'none') return 'shadow'
  if (!isLength(value)) return null
  if (radiusName.test(name)) return 'radius'
  if (strokeName.test(name)) return 'stroke'
  if (spacingName.test(name)) return 'spacing'
  return null
}

type Resolved = {
  // The names of the variables, in the sequence of their first declaration.
  names: string[]
  base: Map<string, string>
  // The values of each media condition, in the sequence of `orderMedia`.
  media: { query: string; values: Map<string, string> }[]
}

function resolveCss(css: string, options: CssVariableOptions): Resolved {
  const rootSize = options.rootFontSize ?? 16
  const declarations = rootDeclarations(css, options.rootSelectors ?? defaultRootSelectors)
  const queries = orderMedia([...new Set(declarations.map((declaration) => declaration.media).filter((media) => media !== ''))])
  const properties = new Set(declarations.map((declaration) => declaration.property))
  return {
    names: [...properties].filter((name) => name.startsWith('--')),
    base: resolveAll(declarations, '', rootSize),
    media: queries.map((query) => ({ query, values: resolveAll(declarations, query, rootSize) })),
  }
}

// The entries of a `media` list that a token needs: the values of the
// conditions, in their sequence, without each one that the entries before it
// already give. For a condition of the width, the value before it is the base
// value or the value of the last wider condition; an entry also stays when a
// condition that only overlaps it has a different value.
function neededMedia(base: string, entries: readonly TokenMediaEntry[]): TokenMediaEntry[] {
  const kept: (TokenMediaEntry & { range: WidthRange | null })[] = []
  for (const entry of entries) {
    const range = widthRange(entry.query)
    let before = base
    let unsure = false
    if (range) {
      for (const earlier of kept) {
        if (!earlier.range || !overlaps(earlier.range, range)) continue
        if (contains(earlier.range, range)) before = earlier.value
        else if (earlier.value !== entry.value) unsure = true
      }
    }
    if (entry.value !== before || unsure) kept.push({ ...entry, range })
  }
  return kept.map(({ query, value }) => ({ query, value }))
}

type TokenMediaEntry = { query: string; value: string }

function mediaOf(resolved: Resolved, name: string): TokenMediaEntry[] {
  const entries: TokenMediaEntry[] = []
  for (const entry of resolved.media) {
    const value = entry.values.get(name)
    if (value !== undefined) entries.push({ query: entry.query, value })
  }
  return entries
}

// The custom properties of the root rules of `css` by their name (with `--`),
// each with its resolved value, as a token has it: each `var()` followed, rem
// in px, a `calc()` of px computed. It is for a value that is not a token by
// itself, such as the parts of a text style (`var(--font-size-xl)`). A
// variable with no value outside a media rule, or whose value cannot be
// resolved, is left out.
export function variablesFromCss(css: string, options: CssVariableOptions = {}): Record<string, CssVariable> {
  const resolved = resolveCss(css, options)
  const variables: Record<string, CssVariable> = {}
  for (const name of resolved.names) {
    const value = resolved.base.get(name)
    if (value !== undefined) variables[name] = { value, media: mediaOf(resolved, name) }
  }
  return variables
}

// The tokens of the custom properties of the root rules of `css`, in the
// sequence of their first declaration. A variable with no value outside a
// media rule, or whose value cannot be resolved, is left out. The id and the
// name of a token are the name of its variable with no `--`.
export function tokensFromCss(css: string, options: CssTokenOptions = {}): Token[] {
  const resolved = resolveCss(css, options)
  const tokens: Token[] = []
  for (const name of resolved.names) {
    const value = resolved.base.get(name)
    if (value === undefined) continue
    const group = groupOf(name, value, options.rules ?? [])
    if (group === null) continue
    const media: TokenMediaValue[] = neededMedia(value, mediaOf(resolved, name))
    const id = name.slice(2)
    tokens.push({
      id,
      group,
      name: id,
      value,
      cssVar: name,
      code: options.code ? options.code(name) : `var(${name})`,
      ...(media.length > 0 ? { media } : {}),
    })
  }
  return tokens
}
