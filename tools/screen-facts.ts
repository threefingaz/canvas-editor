// The static facts of a screen file: what the code itself says, read with the
// parser and with no browser. The check of the screens (`check.ts`) and the
// list of screens (`screens.ts`) use them.
//
// - each JSX element with its place, its tag and its origin (the same rule as
//   the element-to-code step);
// - each element with a `style` attribute;
// - each raw value: a text literal in an attribute of an opening tag that is a
//   CSS value with a length in `px`, `rem` or `em`, or with a color (hex, or a
//   color function). A number literal is not a raw value: the scales of a
//   library are numbers (`spacing={2}`), and the file cannot tell a step of a
//   scale from a count of pixels;
// - each element that sets a value in the file (`sets`): it has a raw value,
//   a `style` attribute, a number that stands for pixels, or in an object of
//   an attribute a text that the code computes (a template literal with an
//   expression).
//   The element-to-code step marks such an element, and the Issues list tells
//   its values from the defaults of the library. The rule is wide on purpose:
//   a wrong mark shows a default of the library as a value of the screen, and
//   a missing mark would hide a deviation;
// - each number that stands for pixels: a number under a key of a size
//   (`sizeKeys`: `fontSize`, `borderRadius`, `padding`) that the pack does
//   not name as a key of a scale of its theme (`scaleKeys` in its manifest).
//   With no such list in the manifest, only a size of the font counts, and
//   only for the mark of the element, not as a finding;
// - each literal link to a screen (`href="#/<id>"`);
// - what a picture of one state must not have: a handler, a hook, a
//   `className`, an import of the tool or of a module with JSX, a placeholder
//   text.
//
// The place of a fact is the place of its element: the `<` of the opening
// tag, 1-based, as the location attribute and a target of a request have it.

import { parseSync, Visitor } from 'vite'
import { screenIdFromHash } from '../src/frame/screen-link.ts'
import type { Origin } from '../src/requests/format.ts'
import { fragmentNames, importSources, isFragment, originOf, position, type LibrarySources } from './jsx.ts'

export type Place = { line: number; column: number }

export type ElementFact = Place & { tag: string; origin: Origin }

// `attribute` is the name of the attribute that has the literal `text`.
// `number` is true for a number that stands for pixels (`fontSize: 14`).
export type RawFact = Place & { tag: string; attribute: string; text: string; number?: true }

// The offsets of a text literal in the code, with its quotes: `code.slice(start,
// end)` is `"#/flow/next"`. The screen actions replace it (`rewriteIds` in
// `screen-ops.ts`).
export type TextRange = { start: number; end: number }

// `id` is the screen id of the address `href`; `range` is the place of the
// literal of the address.
export type LinkFact = Place & { tag: string; href: string; id: string; range: TextRange }

export type ScreenFacts = {
  elements: ElementFact[]
  // The elements with a `style` attribute.
  styles: (Place & { tag: string })[]
  raw: RawFact[]
  links: LinkFact[]
  // The places of the elements that set a value in the file.
  sets: Place[]
  // The behavior that a picture of one state must not have: a handler
  // (`onClick`) and a hook (`useState`).
  behavior: (Place & { text: string })[]
  // The elements with a `className` attribute.
  classNames: (Place & { tag: string })[]
  // The imports of a file of the project (a relative path) and of a virtual
  // module of the tool. The check decides which of them a screen must not
  // have (`forbiddenImport` in `check.ts`).
  imports: (Place & { source: string })[]
  // The places of a placeholder text ("Lorem ipsum").
  placeholders: Place[]
}

const length = /^-?(\d+\.?\d*|\.\d+)(px|rem|em)$/
const hexColor = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const colorFunction = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i
// A part of a CSS value that is not raw: a keyword, a number, a percentage, a
// sign of `calc`, a length of the viewport or of a grid.
const plain = /^([a-z-]*|-?(\d+\.?\d*|\.\d+)(%|vh|vw|dvh|svh|lvh|fr|ch|deg|s|ms)?|[-+*/])$/

// The parts of a CSS value: the words between spaces, commas, brackets and
// the signs `/`, `*` and `!` (`14px/20px`, `2*8px`, `16px !important`). The
// address of `url(#fade)` is not a part: it reads as a hex color.
function partsOf(value: string): string[] {
  return value
    .replace(/url\([^)]*\)/gi, ' ')
    .split(/[\s,()/*!]+/)
    .filter((part) => part !== '')
}

// True for a text that is a CSS value with a raw length or a raw color:
// `'16px'`, `'24px 64px'`, `'#667085'`, `'1px solid #ccc'`,
// `'calc(100% - 16px)'`, `'rgba(0, 0, 0, 0.2)'`. `'100vh'`, `'100%'` and
// `'1fr'` are layout, not raw values.
//
// A text directly in an attribute can be a text for a person, thus each of
// its parts must be a part of a CSS value: "Up to 20px" is not one. A text in
// an object of an attribute (`wide`) is a value of a style object: one raw
// part is enough (`'1px solid currentColor'`, `'translateY(-2px)'`).
export function isRawValue(text: string, wide = false): boolean {
  const value = text.trim()
  if (value === '') return false
  if (colorFunction.test(value)) return true
  let raw = false
  for (const part of partsOf(value)) {
    if (length.test(part) || hexColor.test(part)) raw = true
    else if (!wide && !plain.test(part)) return false
  }
  return raw
}

// The values of a raw text as the page shows them: each length in `px` as its
// number (`'24px 64px'` gives `24` and `64`) and each hex color as `#RRGGBB`
// in capital letters. Null when the text has a value that the page shows in a
// different form: a length in `rem` or `em`, a color function.
export function pageValues(text: string): string[] | null {
  if (colorFunction.test(text)) return null
  const values: string[] = []
  for (const part of partsOf(text.trim())) {
    const size = length.exec(part)
    if (size) {
      if (size[2] !== 'px') return null
      values.push(String(Math.abs(Number(size[1]))))
    } else if (hexColor.test(part)) {
      const hex = part.slice(1).toUpperCase()
      const full = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex
      values.push(`#${full.slice(0, 6)}`)
    }
  }
  return values
}

// The attributes that have an address, a name or a text for a person, not a
// value of a style: a fragment address such as `#fade` and a label such as
// `#1234` read as a hex color.
const noValue: ReadonlySet<string> = new Set([
  'href', 'to', 'id', 'htmlFor', 'key', 'name', 'src', 'label', 'title', 'alt', 'placeholder', 'helperText',
  'aria-label', 'aria-description', 'value', 'defaultValue', 'primary', 'secondary', 'subheader', 'children',
  'text', 'content', 'description', 'message', 'caption', 'name',
])

type Node = { type: string; start: number; end: number; [key: string]: unknown }

// A text literal of an attribute value; `nested` when it is in an object.
// `start` and `end` are the offsets of the literal with its quotes.
type Literal = TextRange & { text: string; nested: boolean }

// The text literals of an attribute value, at each depth of an object, an
// array, a condition and the arguments of a call. A nested JSX element is not
// read here: its own opening tag has its own facts. A function is not read.
function literalTexts(node: Node | null | undefined, into: Literal[], nested = false): void {
  if (!node) return
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') into.push({ text: node.value, nested, start: node.start, end: node.end })
      return
    case 'TemplateLiteral': {
      const quasis = node.quasis as { value: { cooked: string | null } }[]
      if ((node.expressions as Node[]).length === 0 && quasis[0]?.value.cooked) {
        into.push({ text: quasis[0].value.cooked, nested, start: node.start, end: node.end })
      }
      return
    }
    case 'JSXExpressionContainer':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      literalTexts(node.expression as Node, into, nested)
      return
    case 'ObjectExpression':
      for (const property of node.properties as Node[]) {
        if (property.type === 'Property') literalTexts(property.value as Node, into, true)
      }
      return
    case 'ArrayExpression':
      for (const element of node.elements as (Node | null)[]) literalTexts(element, into, nested)
      return
    case 'ConditionalExpression':
      literalTexts(node.consequent as Node, into, nested)
      literalTexts(node.alternate as Node, into, nested)
      return
    case 'LogicalExpression':
      literalTexts(node.left as Node, into, nested)
      literalTexts(node.right as Node, into, nested)
      return
    case 'CallExpression':
      for (const argument of node.arguments as Node[]) literalTexts(argument, into, nested)
      return
  }
}

// The keys of a style object, and the props of the same name, whose number
// is a count of pixels when the library does not map the key to a scale of
// its theme: the sizes of the font, the corners, the lines and the spacing,
// as CSS names them. A key of a library alone (`p`, `spacing`) is not in the
// list: its number is always a step of a scale.
const sides = ['', 'Top', 'Right', 'Bottom', 'Left', 'Inline', 'Block', 'X', 'Y']
export const sizeKeys: ReadonlySet<string> = new Set([
  'fontSize',
  'letterSpacing',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
  'borderWidth',
  ...sides.map((side) => `padding${side}`),
  ...sides.map((side) => `margin${side}`),
  'gap',
  'rowGap',
  'columnGap',
])

// With no list of the pack, only a size of the font is taken as pixels: a
// number under each other key can be a step of a scale.
const fontKeys: ReadonlySet<string> = new Set(['fontSize', 'letterSpacing'])

// The keys of the text style whose number is not a count of pixels.
const textKeys: ReadonlySet<string> = new Set(['lineHeight', 'fontWeight'])

// The keys whose number is a step of a scale of the theme: `scaleKeys` of the
// manifest of the pack, or null when the pack does not say.
export type ScaleKeys = ReadonlySet<string> | null

function isPixelKey(key: string, scale: ScaleKeys): boolean {
  return scale === null ? fontKeys.has(key) : sizeKeys.has(key) && !scale.has(key)
}

type Found = {
  // `fontSize: 14`: a number that stands for pixels, with its key.
  numbers: string[]
  // A text that the code computes (a template literal with an expression) as
  // a value of an object.
  computed: boolean
}

// Reads an attribute value for the numbers that stand for pixels and for a
// computed text. `key` is the key of the value: the name of the attribute at
// first, then the key of the object; a key of a size stays for the values
// below it (the keys of a responsive object, `fontSize: { xs: 12, md: 14 }`).
function findNumbers(node: Node | null | undefined, key: string, scale: ScaleKeys, nested: boolean, found: Found): void {
  if (!node) return
  switch (node.type) {
    case 'Literal':
      if (typeof node.value !== 'number' || node.value === 0) return
      if (isPixelKey(key, scale)) found.numbers.push(`${key}: ${node.value}`)
      // A number of the text style is no count of pixels, but it sets a
      // value of the text: the element gets the mark.
      else if (textKeys.has(key)) found.computed = true
      return
    case 'UnaryExpression': {
      const argument = node.argument as Node
      if (node.operator === '-' && argument.type === 'Literal' && typeof argument.value === 'number' && isPixelKey(key, scale)) {
        found.numbers.push(`${key}: -${argument.value}`)
      }
      return
    }
    case 'TemplateLiteral':
      // Only as a value of an object: a computed text of an attribute itself
      // is a label for a person (`aria-label`).
      if (nested && (node.expressions as Node[]).length > 0) found.computed = true
      return
    case 'JSXExpressionContainer':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      findNumbers(node.expression as Node, key, scale, nested, found)
      return
    case 'ObjectExpression':
      for (const property of node.properties as Node[]) {
        if (property.type !== 'Property') continue
        const name = property.key as Node
        const text = name.type === 'Identifier' ? (name.name as string) : typeof name.value === 'string' ? name.value : null
        const next = sizeKeys.has(key) || text === null ? key : text
        findNumbers(property.value as Node, next, scale, true, found)
      }
      return
    case 'ArrayExpression':
      for (const element of node.elements as (Node | null)[]) findNumbers(element, key, scale, nested, found)
      return
    case 'ConditionalExpression':
      findNumbers(node.consequent as Node, key, scale, nested, found)
      findNumbers(node.alternate as Node, key, scale, nested, found)
      return
    case 'LogicalExpression':
      findNumbers(node.left as Node, key, scale, nested, found)
      findNumbers(node.right as Node, key, scale, nested, found)
      return
    case 'BinaryExpression':
      // `14 * 2`: the code computes the value.
      if (nested) found.computed = true
      return
    // A call is not read: `theme.spacing(2)` has a number that is a step.
  }
}

// What the attributes of one opening tag say: `node` is a `JSXOpeningElement`
// of the parser.
export type TagValues = {
  style: boolean
  // `number` is true for a number that stands for pixels; then `text` is
  // `<key>: <number>`.
  raw: { attribute: string; text: string; number?: true }[]
  // The text literals of the `href` attribute, with their places.
  hrefs: (TextRange & { text: string })[]
  // The names of the attributes that are a handler (`onClick`).
  handlers: string[]
  // The element has a `className` attribute.
  className: boolean
  // The element sets a value in the file (see the head of this module).
  sets: boolean
  // The values that the element sets, as the page shows them: a count of
  // pixels with no unit (`16`) and a color as `#RRGGBB`. Null when the file
  // does not say them all (a `style` attribute, a computed text, a length in
  // `rem` or `em`, a color function): then each value of the element counts.
  values: string[] | null
}

export function tagValues(node: { attributes: readonly unknown[] }, code: string, scale: ScaleKeys = null): TagValues {
  const values: TagValues = { style: false, raw: [], hrefs: [], handlers: [], className: false, sets: false, values: [] }
  const marked = new Set<string>()
  let open = false
  for (const attribute of node.attributes as Node[]) {
    if (attribute.type !== 'JSXAttribute') continue
    const name = code.slice((attribute.name as Node).start, (attribute.name as Node).end)
    const texts: Literal[] = []
    literalTexts(attribute.value as Node | null, texts)
    if (name === 'style') values.style = true
    if (name === 'className') values.className = true
    if (/^on[A-Z]/.test(name) && (attribute.value as Node | null)?.type === 'JSXExpressionContainer') values.handlers.push(name)
    if (name === 'href') values.hrefs.push(...texts.map(({ text, start, end }) => ({ text, start, end })))
    if (noValue.has(name)) continue
    for (const { text, nested } of texts) {
      if (!isRawValue(text, nested)) continue
      values.raw.push({ attribute: name, text })
      const parts = pageValues(text)
      if (parts === null) open = true
      else for (const part of parts) marked.add(part)
    }
    // Each attribute with an object can be the style object of a library:
    // the name of the override is different in each library.
    const found: Found = { numbers: [], computed: false }
    findNumbers(attribute.value as Node | null, name, scale, false, found)
    // With no list of the pack a number is not a finding: it only marks its
    // element, thus the Issues list of the editor shows its value.
    if (scale !== null) for (const text of found.numbers) values.raw.push({ attribute: name, text, number: true })
    if (found.computed || found.numbers.length > 0) values.sets = true
    if (found.computed) open = true
    for (const text of found.numbers) {
      // The spacing of the letters has no value of its own on the page: it
      // is a part of the text style.
      if (text.startsWith('letterSpacing:')) open = true
      else marked.add(String(Math.abs(Number(text.slice(text.indexOf(':') + 1)))))
    }
  }
  if (values.style || values.raw.length > 0) values.sets = true
  values.values = values.style || open ? null : [...marked]
  return values
}

const placeholder = /lorem ipsum/i

// Throws with the message of the parser when the code has a syntax error.
// `library` is the sources of the library, or null when no library
// is connected: then no element has the origin `library`. `scale` is the list
// of the scale keys of the pack, or null.
export function screenFacts(code: string, file: string, library: LibrarySources | null, scale: ScaleKeys = null): ScreenFacts {
  const { program, errors } = parseSync(file, code)
  if (errors.length > 0) throw new Error(`${file}: ${errors[0].message}`)

  const fragments = fragmentNames(program)
  const imports = importSources(program)
  const facts: ScreenFacts = { elements: [], styles: [], raw: [], links: [], sets: [], behavior: [], classNames: [], imports: [], placeholders: [] }

  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') continue
    const source = statement.source.value
    if (source.startsWith('.') || source.startsWith('/') || source.startsWith('virtual:')) facts.imports.push({ ...position(code, statement.start), source })
  }

  new Visitor({
    JSXOpeningElement(node) {
      const name = code.slice(node.name.start, node.name.end)
      if (isFragment(name, fragments)) return
      const tag = name.replaceAll(/\s+/g, '')
      const place = position(code, node.start)
      facts.elements.push({ ...place, tag, origin: originOf(tag, imports, library, file) })

      const values = tagValues(node, code, scale)
      if (values.style) facts.styles.push({ ...place, tag })
      if (values.className) facts.classNames.push({ ...place, tag })
      if (values.sets) facts.sets.push(place)
      for (const raw of values.raw) facts.raw.push({ ...place, tag, ...raw })
      for (const handler of values.handlers) facts.behavior.push({ ...place, text: `${tag}: the handler \`${handler}\`` })
      for (const { text: href, start, end } of values.hrefs) {
        const id = screenIdFromHash(href)
        if (id !== null) facts.links.push({ ...place, tag, href, id, range: { start, end } })
      }
    },
    JSXText(node) {
      if (placeholder.test(node.value)) facts.placeholders.push(position(code, node.start))
    },
    CallExpression(node) {
      // A hook: a screen is a picture of one state.
      const callee = node.callee as unknown as Node
      // `useState(…)` and `React.useState(…)`; a method of a different object
      // with such a name is no hook.
      const object = callee.type === 'MemberExpression' ? (callee.object as Node) : null
      const name =
        callee.type === 'Identifier'
          ? (callee.name as string)
          : object?.type === 'Identifier' && object.name === 'React'
            ? ((callee.property as Node).name as string | undefined)
            : undefined
      if (name !== undefined && /^use[A-Z]/.test(name)) facts.behavior.push({ ...position(code, node.start), text: `the hook \`${name}\`` })
    },
  }).visit(program)

  return facts
}

// The ids of the screens that the file links to, in the order of the code,
// each one time.
export function linkIds(facts: ScreenFacts): string[] {
  return [...new Set(facts.links.map((link) => link.id))]
}
