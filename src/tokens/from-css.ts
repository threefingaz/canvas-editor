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

// The declarations that hold in a context: those with no media condition and
// those of the condition `media`; a later one wins, as in the stylesheet.
function contextValues(declarations: readonly Declaration[], media: string): Map<string, string> {
  const values = new Map<string, string>()
  for (const declaration of declarations) {
    if (declaration.media === '' || declaration.media === media) {
      values.set(declaration.property, declaration.value)
    }
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

// The tokens of the custom properties of the root rules of `css`, in the
// sequence of their first declaration. A variable with no value outside a
// media rule, or whose value cannot be resolved, is left out.
export function tokensFromCss(css: string, options: CssTokenOptions = {}): Token[] {
  const base = options.rootFontSize ?? 16
  const declarations = rootDeclarations(css, options.rootSelectors ?? defaultRootSelectors)
  const queries = [...new Set(declarations.map((declaration) => declaration.media).filter((media) => media !== ''))]
  const baseValues = resolveAll(declarations, '', base)
  const mediaValues = queries.map((query) => ({ query, values: resolveAll(declarations, query, base) }))

  const names = [...new Set(declarations.map((declaration) => declaration.property))]
  const tokens: Token[] = []
  for (const name of names) {
    const value = baseValues.get(name)
    if (value === undefined) continue
    const group = groupOf(name, value, options.rules ?? [])
    if (group === null) continue
    const media: TokenMediaValue[] = []
    for (const entry of mediaValues) {
      const there = entry.values.get(name)
      if (there !== undefined && there !== value) media.push({ query: entry.query, value: there })
    }
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
