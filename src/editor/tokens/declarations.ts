// The pure parts of the reading of declared values: which properties can set a
// property, the variables in a text and their factors, and the walk through
// the CSS rules of a document.
//
// The rules are those of a frame document, thus this module uses no
// `instanceof` with the classes of the editor window. It reads the kind of a
// rule from its constructor name, and the tests give plain objects with a
// constructor of that name.

import { splitTop } from './normalize.ts'

// The members of a `CSSStyleDeclaration` that the reading uses.
// `getPropertyPriority` gives `important` or an empty text.
export type DeclarationsLike = {
  getPropertyValue: (name: string) => string
  getPropertyPriority: (name: string) => string
}

// The members of a `CSSRule` (and of its subclasses) that the reading uses.
export type RuleLike = {
  selectorText?: string
  style?: DeclarationsLike
  cssRules?: ArrayLike<RuleLike>
  media?: { mediaText: string }
  conditionText?: string
  styleSheet?: { cssRules?: ArrayLike<RuleLike> } | null
}

export type StyleRuleLike = RuleLike & { selectorText: string; style: DeclarationsLike }

// `group`: a group rule that this reading does not evaluate (`@layer`,
// `@container`, `@scope`); its rules count as applying. `nested`: the
// declarations that follow a nested rule inside a style rule
// (`CSSNestedDeclarations`); they belong to the selector of that style rule.
export type RuleKind = 'style' | 'nested' | 'import' | 'media' | 'supports' | 'group' | 'other'

const kindsByName: Record<string, RuleKind> = {
  CSSStyleRule: 'style',
  CSSNestedDeclarations: 'nested',
  CSSImportRule: 'import',
  CSSMediaRule: 'media',
  CSSSupportsRule: 'supports',
  CSSLayerBlockRule: 'group',
  CSSContainerRule: 'group',
  CSSScopeRule: 'group',
}

export function ruleKind(rule: RuleLike): RuleKind {
  const name = (rule as { constructor?: { name?: string } }).constructor?.name
  return (name && kindsByName[name]) || 'other'
}

// A style rule and the condition of the media rules (and the `@import`
// rules) that hold it, joined with `and`; no condition when none holds it.
// A nested rule gives a rule with its absolute selector (see
// `nestedSelector`) and its own declarations.
export type RuleEntry = { rule: StyleRuleLike; media?: string }

// The absolute selector of a nested rule: each `&` is the parent selector, as
// `:is(<parent>)`; a part with no `&` is a descendant of the parent. The
// specificity of `:is()` is that of the strongest part of the parent, as CSS
// counts a nested selector.
export function nestedSelector(parent: string, child: string): string {
  const scope = `:is(${parent})`
  return selectorParts(child)
    .map((part) => (part.includes('&') ? part.replaceAll('&', scope) : `${scope} ${part}`))
    .join(', ')
}

// The style rules of a list of rules, in the sequence of the document. It goes
// into the group rules (`@media`, `@supports`, `@layer`, `@container`,
// `@scope`) and the sheets of `@import` rules for which `applies` is true,
// and into the nested rules of a style rule, after the declarations of the
// rule itself.
export function walkRules(rules: ArrayLike<RuleLike>, applies: (rule: RuleLike) => boolean): RuleEntry[] {
  const result: RuleEntry[] = []
  const push = (rule: StyleRuleLike, conditions: readonly string[]) => {
    const entry: RuleEntry = { rule }
    if (conditions.length > 0) entry.media = conditions.join(' and ')
    result.push(entry)
  }
  // `parent`: the absolute selector of the style rule that holds the list,
  // or null at the top level.
  const walk = (list: ArrayLike<RuleLike>, conditions: readonly string[], parent: string | null) => {
    for (const rule of Array.from(list)) {
      const kind = ruleKind(rule)
      if (kind === 'style') {
        if (rule.selectorText === undefined || !rule.style) continue
        const selector = parent === null ? rule.selectorText : nestedSelector(parent, rule.selectorText)
        push(parent === null ? (rule as StyleRuleLike) : { selectorText: selector, style: rule.style }, conditions)
        if (rule.cssRules && rule.cssRules.length > 0) walk(rule.cssRules, conditions, selector)
        continue
      }
      if (kind === 'nested') {
        if (parent !== null && rule.style) push({ selectorText: parent, style: rule.style }, conditions)
        continue
      }
      const media = (kind === 'media' || kind === 'import') && rule.media?.mediaText.trim()
      const inner = media ? [...conditions, media] : conditions
      if (kind === 'import') {
        const sheet = rule.styleSheet?.cssRules
        if (sheet && applies(rule)) walk(sheet, inner, null)
      } else if (kind !== 'other') {
        if (rule.cssRules && applies(rule)) walk(rule.cssRules, inner, parent)
      }
    }
  }
  walk(rules, [], null)
  return result
}

// The sides in the order of the CSS shorthands (`padding: 1px 2px 3px 4px`).
export const sides = ['top', 'right', 'bottom', 'left'] as const
export type Side = (typeof sides)[number]

// The corners in the order of `border-radius`: from the top left, clockwise.
export const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const
export type Corner = (typeof corners)[number]

// The logical properties of a side in a document that is left to right and
// horizontal.
const logicalSides: Record<Side, { axis: 'block' | 'inline'; logical: string }> = {
  top: { axis: 'block', logical: 'block-start' },
  right: { axis: 'inline', logical: 'inline-end' },
  bottom: { axis: 'block', logical: 'block-end' },
  left: { axis: 'inline', logical: 'inline-start' },
}

const logicalCorners: Record<Corner, string> = {
  'top-left': 'start-start',
  'top-right': 'start-end',
  'bottom-right': 'end-end',
  'bottom-left': 'end-start',
}

type BorderPart = 'width' | 'color' | 'style'

// A property of one side or one corner, read once for `shorthandsOf` and
// `positionIn`. `padding-left`: box `padding`, side `left`.
// `border-left-width`: box `border`, side `left`, part `width`.
type PlaceProperty =
  | { kind: 'side'; box: 'padding' | 'margin'; side: Side; part: null }
  | { kind: 'side'; box: 'border'; side: Side; part: BorderPart }
  | { kind: 'corner'; corner: Corner }

const sidePattern = sides.join('|')
const boxSideProperty = new RegExp(`^(padding|margin)-(${sidePattern})$`)
const borderSideProperty = new RegExp(`^border-(${sidePattern})-(width|color|style)$`)
const cornerProperty = new RegExp(`^border-(${corners.join('|')})-radius$`)

function placeOf(property: string): PlaceProperty | null {
  const box = boxSideProperty.exec(property)
  if (box) return { kind: 'side', box: box[1] as 'padding' | 'margin', side: box[2] as Side, part: null }
  const border = borderSideProperty.exec(property)
  if (border) return { kind: 'side', box: 'border', side: border[1] as Side, part: border[2] as BorderPart }
  const corner = cornerProperty.exec(property)
  if (corner) return { kind: 'corner', corner: corner[1] as Corner }
  return null
}

const simpleShorthands: Record<string, string[]> = {
  'background-color': ['background'],
  'font-family': ['font'],
  'font-size': ['font'],
  'font-weight': ['font'],
  'font-style': ['font'],
  'line-height': ['font'],
  'row-gap': ['gap'],
  'column-gap': ['gap'],
  'flex-direction': ['flex-flow'],
  'flex-wrap': ['flex-flow'],
  'flex-grow': ['flex'],
  'flex-shrink': ['flex'],
  'flex-basis': ['flex'],
  'align-items': ['place-items'],
  'justify-items': ['place-items'],
  'align-content': ['place-content'],
  'justify-content': ['place-content'],
  'align-self': ['place-self'],
  'justify-self': ['place-self'],
}

// The other properties that can set a property: its shorthands, and for a
// physical side or corner, the logical properties of that side in a document
// that is left to right and horizontal (for example `padding-left` gives
// `padding`, `padding-inline` and `padding-inline-start`).
export function shorthandsOf(property: string): string[] {
  const place = placeOf(property)
  if (place?.kind === 'corner') return ['border-radius', `border-${logicalCorners[place.corner]}-radius`]
  if (place?.kind === 'side') {
    const { axis, logical } = logicalSides[place.side]
    if (place.part === null) return [place.box, `${place.box}-${axis}`, `${place.box}-${logical}`]
    const { side, part } = place
    return [
      'border',
      `border-${part}`,
      `border-${side}`,
      `border-${axis}`,
      `border-${axis}-${part}`,
      `border-${logical}`,
      `border-${logical}-${part}`,
    ]
  }
  return simpleShorthands[property] ?? []
}

// Each variable in a text, once, in the sequence of the text.
export function variablesIn(text: string): string[] {
  const names = new Set<string>()
  for (const match of text.matchAll(/var\(\s*(--[\w-]+)/g)) names.add(match[1])
  return [...names]
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// The index after the parenthesis that closes the one at `open`.
function closeOf(text: string, open: number): number {
  let depth = 0
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '(') depth += 1
    if (text[index] === ')') {
      depth -= 1
      if (depth === 0) return index + 1
    }
  }
  return text.length
}

const number = String.raw`(-?\d*\.?\d+)`

// The factor of each use of `cssVar` in a text: `calc(2 * var(--x))` and
// `calc(var(--x) * 2)` give 2, `calc(var(--x) / 2)` gives 0.5, a plain
// `var(--x)` gives 1.
export function factorsOf(text: string, cssVar: string): number[] {
  const factors: number[] = []
  const use = new RegExp(`var\\(\\s*${escapeRegExp(cssVar)}(?=[\\s,)])`, 'g')
  for (const match of text.matchAll(use)) {
    const start = match.index
    const end = closeOf(text, start + 3)
    const before = new RegExp(`${number}\\s*\\*\\s*$`).exec(text.slice(0, start))
    const after = text.slice(end)
    const times = new RegExp(`^\\s*\\*\\s*${number}`).exec(after)
    const divided = new RegExp(`^\\s*\\/\\s*${number}`).exec(after)
    if (before) factors.push(Number(before[1]))
    else if (times) factors.push(Number(times[1]))
    else if (divided) factors.push(1 / Number(divided[1]))
    else factors.push(1)
  }
  return factors
}

// Where a property is in the values of a shorthand: `count` values in the
// order of CSS (top, right, bottom, left; or the four corners from the top
// left; or start, end), and the index of the property. Null for a shorthand
// whose values are not by side (`border`, `font`, `background`).
function positionIn(property: string, shorthand: string): { count: 2 | 4; index: number } | null {
  const place = placeOf(property)
  if (place?.kind === 'side') {
    const { box, side } = place
    const suffix = place.part === null ? '' : `-${place.part}`
    if (shorthand === `${box}${suffix}`) return { count: 4, index: sides.indexOf(side) }
    if (shorthand === `${box}-${logicalSides[side].axis}${suffix}`) {
      return { count: 2, index: side === 'top' || side === 'left' ? 0 : 1 }
    }
    return null
  }
  if (place?.kind === 'corner') {
    return shorthand === 'border-radius' ? { count: 4, index: corners.indexOf(place.corner) } : null
  }
  if (shorthand === 'gap' && (property === 'row-gap' || property === 'column-gap')) {
    return { count: 2, index: property === 'row-gap' ? 0 : 1 }
  }
  return null
}

// The part of a shorthand text that sets `property`: `padding: 8px 16px` gives
// `16px` for `padding-left`. The whole text for a shorthand whose values are
// not by side, or for a text that does not have 1 to `count` values. For
// `border-radius`, the part before `/` (the horizontal radii).
export function shorthandPart(property: string, shorthand: string, text: string): string {
  const position = positionIn(property, shorthand)
  if (!position) return text
  const main = shorthand === 'border-radius' ? (splitTop(text, /\//)[0] ?? text) : text
  const values = splitTop(main, /\s/)
  if (values.length === 0 || values.length > position.count) return text
  const [a, b = a, c = a, d = b] = values
  return (position.count === 4 ? [a, b, c, d] : [a, b])[position.index]
}

// The specificity of a selector: the ids, the classes (with the attributes
// and the pseudo classes), and the types (with the pseudo elements).
export type Specificity = readonly [number, number, number]

const zero: Specificity = [0, 0, 0]

function add(a: Specificity, b: Specificity): Specificity {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

// A negative number when `a` is weaker than `b`, zero when they are equal.
export function compareSpecificity(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

function strongest(list: readonly Specificity[]): Specificity {
  return list.reduce((best, item) => (compareSpecificity(item, best) > 0 ? item : best), zero)
}

// The pseudo elements that CSS also accepts with one colon.
const oldPseudoElements = new Set(['before', 'after', 'first-line', 'first-letter'])

// The pseudo classes that count as the strongest selector of their argument.
// Each other pseudo class with an argument counts as one class.
const strongestOfArgument = new Set(['is', 'not', 'has'])

type Read = { value: Specificity; end: number }

function isNameChar(char: string): boolean {
  return /[\w-]/.test(char) || char.charCodeAt(0) >= 0x80
}

// The index after the name that starts at `start`, with its escapes; `start`
// when there is no name.
function nameEnd(text: string, start: number): number {
  let index = start
  while (index < text.length) {
    const char = text[index]
    if (char === '\\') {
      if (index + 1 >= text.length) return index
      const hex = /^[0-9a-fA-F]{1,6}\s?/.exec(text.slice(index + 1))
      index += 1 + (hex ? hex[0].length : 1)
    } else if (isNameChar(char)) {
      index += 1
    } else {
      break
    }
  }
  return index
}

// The index after the bracket or the parenthesis that closes the one at
// `open`, with quoted texts skipped; -1 when it is not closed.
function closeAt(text: string, open: number): number {
  const close = text[open] === '[' ? ']' : ')'
  let depth = 0
  for (let index = open; index < text.length; index += 1) {
    const char = text[index]
    if (char === '\\') {
      index += 1
    } else if (char === '"' || char === "'") {
      const end = text.indexOf(char, index + 1)
      if (end < 0) return -1
      index = end
    } else if (char === text[open]) {
      depth += 1
    } else if (char === close) {
      depth -= 1
      if (depth === 0) return index + 1
    }
  }
  return -1
}

// A list of selectors from `start` to the end of the text or, when `nested`,
// to the parenthesis that closes it (`end` is the index of that parenthesis).
// The value is the strongest selector of the list. Null when it cannot be
// read.
function readList(text: string, start: number, nested: boolean): Read | null {
  const parts: Specificity[] = []
  let index = start
  for (;;) {
    const part = readComplex(text, index)
    if (!part) return null
    parts.push(part.value)
    index = part.end
    if (text[index] === ',') {
      index += 1
      continue
    }
    if (nested ? text[index] !== ')' : index !== text.length) return null
    return { value: strongest(parts), end: index }
  }
}

// One selector with its combinators, up to a comma, a closing parenthesis or
// the end of the text. Null when it has no simple selector or cannot be read.
function readComplex(text: string, start: number): Read | null {
  let value = zero
  let simple = false
  let index = start
  while (index < text.length) {
    const char = text[index]
    if (char === ',' || char === ')') break
    if (/[\s>+~|]/.test(char)) {
      index += 1
      continue
    }
    const read = readSimple(text, index)
    if (!read) return null
    value = add(value, read.value)
    index = read.end
    simple = true
  }
  return simple ? { value, end: index } : null
}

// One simple selector: a type, `*`, `&`, an id, a class, an attribute, a
// pseudo class or a pseudo element.
function readSimple(text: string, start: number): Read | null {
  const char = text[start]
  if (char === '*' || char === '&') return { value: zero, end: start + 1 }
  if (char === '#' || char === '.') {
    const end = nameEnd(text, start + 1)
    if (end === start + 1) return null
    return { value: char === '#' ? [1, 0, 0] : [0, 1, 0], end }
  }
  if (char === '[') {
    const end = closeAt(text, start)
    return end < 0 ? null : { value: [0, 1, 0], end }
  }
  if (char === ':') return readPseudo(text, start)
  const end = nameEnd(text, start)
  return end === start ? null : { value: [0, 0, 1], end }
}

function readPseudo(text: string, start: number): Read | null {
  const element = text[start + 1] === ':'
  const nameStart = start + (element ? 2 : 1)
  const end = nameEnd(text, nameStart)
  if (end === nameStart) return null
  const name = text.slice(nameStart, end).toLowerCase()
  const own: Specificity = element || oldPseudoElements.has(name) ? [0, 0, 1] : [0, 1, 0]
  if (text[end] !== '(') return { value: own, end }

  if (!element && (name === 'where' || strongestOfArgument.has(name))) {
    const list = readList(text, end + 1, true)
    if (!list) return null
    return { value: name === 'where' ? zero : list.value, end: list.end + 1 }
  }
  const close = closeAt(text, end)
  return close < 0 ? null : { value: own, end: close }
}

// The specificity of a selector. A selector list gives its strongest part.
// A selector that cannot be read gives zero.
export function specificity(selector: string): Specificity {
  return readList(selector, 0, false)?.value ?? zero
}

// One declaration of a property for an element: its text, whether it is
// `!important`, whether it is in the inline style or in a rule, the
// specificity of the part of the selector that matches the element, the
// condition of the media rule that holds it, and its position in the
// sequence of the document (the inline style comes last).
export type DeclarationSource = {
  text: string
  important: boolean
  kind: 'inline' | 'rule'
  specificity: Specificity
  media?: string
  position: number
}

// The order of strength of two sources: `!important`, then the inline style,
// then the specificity, then the position. `@layer` is not calculated.
function compareSources(a: DeclarationSource, b: DeclarationSource): number {
  if (a.important !== b.important) return a.important ? 1 : -1
  if (a.kind !== b.kind) return a.kind === 'inline' ? 1 : -1
  return compareSpecificity(a.specificity, b.specificity) || a.position - b.position
}

// The declaration that wins among the sources of a property. A source with an
// empty text does not declare the property. Null when no source declares it.
export function winner<T extends DeclarationSource>(sources: readonly T[]): T | null {
  let best: T | null = null
  for (const source of sources) {
    if (!source.text) continue
    if (!best || compareSources(source, best) >= 0) best = source
  }
  return best
}

// The parts of a selector list, split at the commas that are not in a
// parenthesis, a bracket or a quoted text.
export function selectorParts(selector: string): string[] {
  const parts: string[] = []
  let start = 0
  let index = 0
  while (index < selector.length) {
    const char = selector[index]
    if (char === '\\') {
      index += 2
    } else if (char === '"' || char === "'") {
      const end = selector.indexOf(char, index + 1)
      index = end < 0 ? selector.length : end + 1
    } else if (char === '(' || char === '[') {
      const end = closeAt(selector, index)
      index = end < 0 ? selector.length : end
    } else if (char === ',') {
      parts.push(selector.slice(start, index))
      index += 1
      start = index
    } else {
      index += 1
    }
  }
  parts.push(selector.slice(start))
  return parts.map((part) => part.trim()).filter((part) => part !== '')
}

// The specificity of the strongest part of a selector list that matches an
// element. Null when no part matches. A part that does not match does not
// count: `.a, #b` on an element with the class `a` has the specificity of
// `.a`.
export function matchingSelector(selector: string, matches: (part: string) => boolean): Specificity | null {
  const parts = selector.includes(',') ? selectorParts(selector) : [selector.trim()]
  const matching = parts.filter((part) => matches(part))
  return matching.length === 0 ? null : specificity(matching.join(', '))
}

// A source of declarations for an element: a CSS rule that matches it, or its
// inline style. `specificity` is that of the part of the selector list that
// matches (see `matchingSelector`), `media` the condition of the media rules
// that hold the rule, and `position` its place in the sequence of the
// document (the inline style comes last).
export type StyleSource = {
  style: DeclarationsLike
  kind: 'inline' | 'rule'
  specificity: Specificity
  media?: string
  position: number
}

// Where the winning declaration of a value is: in the inline style or in a
// rule, with the condition of the media rules of the rule.
export type ValueSource = { inline: boolean; media?: string }

// The winning declaration of a property: its text, then the texts of the
// variables that it follows (each the winner among the same sources), and
// its source.
export type DeclaredValue = { texts: string[]; source: ValueSource }

// The text and the priority of a property in one source: the text of the
// property, or, when it is empty, the text of a property that can set it. A
// longhand of a shorthand with `var()` reads as an empty text, thus the
// shorthand is read, and of a shorthand by side only the part of the side
// (`shorthandPart`). Of two shorthands, the more specific one is read
// (`padding-inline` before `padding`).
function candidateOf(property: string, source: StyleSource): DeclarationSource {
  const { style, kind, specificity: strength, media, position } = source
  const base = { kind, specificity: strength, position, ...(media ? { media } : {}) }
  const own = style.getPropertyValue(property).trim()
  if (own) return { ...base, text: own, important: style.getPropertyPriority(property) === 'important' }
  for (const other of [...shorthandsOf(property)].reverse()) {
    const text = style.getPropertyValue(other).trim()
    if (text) {
      const important = style.getPropertyPriority(other) === 'important'
      return { ...base, text: shorthandPart(property, other, text), important }
    }
  }
  return { ...base, text: '', important: false }
}

// The declaration of a property that wins among the sources of an element
// (see `winner`), and the texts of the variables that it uses, when a source
// declares them (for example a component that sets `--variant-bg` to a token
// variable and the fill to `var(--variant-bg)`). A rule that matches but
// loses gives no text. A variable that no source of the element declares is
// read from `rootSources`, the sources of the root element, where a library
// declares its aliases (`--widget-radius: var(--radius-xl)`). A variable that
// a parent between the element and the root declares is not followed. Null
// when no source declares the property.
export function declaredValue(
  property: string,
  sources: readonly StyleSource[],
  rootSources: () => readonly StyleSource[] = () => [],
): DeclaredValue | null {
  const best = winner(sources.map((source) => candidateOf(property, source)))
  if (!best) return null

  const texts = [best.text]
  const seen = new Set<string>()
  const queue = variablesIn(best.text)
  while (queue.length > 0) {
    const name = queue.shift() as string
    if (seen.has(name)) continue
    seen.add(name)
    const found =
      winner(sources.map((source) => candidateOf(name, source))) ??
      winner(rootSources().map((source) => candidateOf(name, source)))
    if (!found) continue
    texts.push(found.text)
    queue.push(...variablesIn(found.text))
  }

  const source: ValueSource = { inline: best.kind === 'inline' }
  if (best.media) source.media = best.media
  return { texts, source }
}
